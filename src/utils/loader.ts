import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WebGPUData } from './webgpu-data';
import {
    addEntity,
    addEntityFromMultiple,
    Entity,
    modelType,
} from '../scene/scene-types';
import { ModelBuffers } from '../scene/buffer-types';
import { getApproximatedGeometry } from './get-sphere-approximator';

// --------------THREE JS PARSER FOR OBJ FILES-------------- //

export function loadMeshFromLink(path: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            path,
            (root) => {
                console.log('Children:', root);
                resolve(root.scene);
            },
            undefined,
            reject
        );
    });
}

export async function loadAndAddObject(path: string) {
    try {
        const loadedGroup = await loadMeshFromLink(path);
        //scene.add(loadedGroup);
        return loadedGroup;
    } catch (error) {
        console.error('Failed to load model:', error);
    }
}

// --------------LOAD ONTO GPUBUFFER-------------- //

const createVertexBuffer = (
    gpu: WebGPUData,
    positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    normals: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    uvs?: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
): GPUBuffer => {
    const hasUVs = uvs && uvs.count === positions.count;
    const stride = hasUVs ? 8 : 6;

    const buffer = gpu.device.createBuffer({
        size: positions.array.length * stride * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });

    const mapping = new Float32Array(buffer.getMappedRange());
    for (let i = 0; i < positions.array.length; ++i) {
        const baseIndex = i * stride;
        const posIndex = i * 3;
        const normalIndex = i * 3;

        mapping[baseIndex] = positions.array[posIndex];
        mapping[baseIndex + 1] = positions.array[posIndex + 1];
        mapping[baseIndex + 2] = positions.array[posIndex + 2];

        mapping[baseIndex + 3] = normals.array[normalIndex];
        mapping[baseIndex + 4] = normals.array[normalIndex + 1];
        mapping[baseIndex + 5] = normals.array[normalIndex + 2];

        if (hasUVs) {
            const uvIndex = i * 2;
            mapping[baseIndex + 6] = uvs.array[uvIndex];
            mapping[baseIndex + 7] = uvs.array[uvIndex + 1];
        }
    }
    buffer.unmap();
    return buffer;
};

const createIndexBuffer = (
    gpu: WebGPUData,
    triangles: THREE.BufferAttribute | null
): GPUBuffer | null => {
    if (!triangles || !triangles.array || triangles.array.length === 0) {
        console.warn('No index data provided to createIndexBuffer');
        return null;
    }

    const indexCount = triangles.array.length;
    const dataSize = indexCount * Uint32Array.BYTES_PER_ELEMENT;
    const alignedSize = Math.ceil(dataSize / 4) * 4;
    const buffer = gpu.device.createBuffer({
        size: alignedSize,
        usage: GPUBufferUsage.INDEX,
        mappedAtCreation: true,
    });

    const mapping = new Uint16Array(buffer.getMappedRange(0, dataSize));
    mapping.set(triangles.array);
    buffer.unmap();
    return buffer;
};

export function getModelBuffersFromTHREEMesh(
    gpu: WebGPUData,
    mesh: THREE.Mesh
): ModelBuffers {
    const geometry = mesh.geometry;

    const positionAttribute = geometry.getAttribute('position');
    const vertexCount = positionAttribute.count;
    const normalAttribute = geometry.getAttribute('normal');

    let indexAttribute = geometry.getIndex();
    const indexCount = indexAttribute?.count || vertexCount;

    const vertexBuffer = createVertexBuffer(
        gpu,
        positionAttribute,
        normalAttribute
    );
    const indexBuffer = createIndexBuffer(gpu, indexAttribute);

    let texture: GPUTexture = giveRandomColor(gpu);

    return {
        vertexBuffer,
        indexBuffer,
        vertexCount,
        indexCount,
        texture,
    };
}

function giveRandomColor(gpu: WebGPUData): GPUTexture {
    const randomColor = new Uint8Array([
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        255,
    ]);

    const randomTexture = gpu.device.createTexture({
        size: [1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    gpu.device.queue.writeTexture(
        { texture: randomTexture },
        randomColor,
        { bytesPerRow: 256 },
        [1, 1]
    );

    return randomTexture;
}

export function getModelBuffers(
    gpu: WebGPUData,
    group: THREE.Group,
    type: modelType,
    pos?: THREE.Vector3,
    rotation?: THREE.Euler,
    scale?: THREE.Vector3
) {
    const meshes: ModelBuffers[] = [];
    const modelMatrices: THREE.Matrix4[] = [];
    const positions: THREE.Vector3[] = [];
    const rotations: THREE.Euler[] = [];
    const scales: THREE.Vector3[] = [];

    group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
            const mesh = getModelBuffersFromTHREEMesh(gpu, obj as THREE.Mesh);

            const modelMatrix = obj.matrixWorld;
            pos = pos || new THREE.Vector3();
            rotation = rotation || new THREE.Euler();
            scale = scale || new THREE.Vector3();
            obj.matrixWorld.decompose(pos, new THREE.Quaternion().setFromEuler(rotation), scale);

            meshes.push(mesh);
            modelMatrices.push(modelMatrix);
            positions.push(pos);
            rotations.push(rotation);
            scales.push(scale);
        }
    });
    return [addEntityFromMultiple(meshes, modelMatrices, type, positions, rotations, scales)];
}

export const vertexBuffers: Iterable<GPUVertexBufferLayout | null | undefined> =
    [
        {
            arrayStride: Float32Array.BYTES_PER_ELEMENT * 6, // 3 position + 3 normal + 2 texCoord
            attributes: [
                {
                    shaderLocation: 0,
                    offset: 0,
                    format: 'float32x3',
                },
                {
                    shaderLocation: 1,
                    offset: Float32Array.BYTES_PER_ELEMENT * 3,
                    format: 'float32x3',
                },
            ],
        },
    ];

export function createEntityFromGeometry(
    gpu: WebGPUData,
    geom: THREE.BufferGeometry,
    type: modelType,
    pos: THREE.Vector3,
    rotation: THREE.Euler,
    scale: number,
    approximateSrc?: string
) {
    const mesh = new THREE.Mesh(geom);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.scale.set(scale, scale, scale);

    mesh.rotation.x = rotation.x ?? mesh.rotation.x;
    mesh.rotation.y = rotation.y ?? mesh.rotation.y;
    mesh.rotation.z = rotation.z ?? mesh.rotation.z;

    mesh.updateMatrixWorld();

    const entity = addEntity(
        getModelBuffersFromTHREEMesh(gpu, mesh),
        mesh.matrixWorld.clone(),
        type,
        mesh.position,
        mesh.rotation,
        mesh.scale
    );
    return entity;
}
