import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { webGPUData } from "./webgpu_data";

//--------------THREE JS PARSER FOR OBJ FILES--------------

export function getRenderer(): THREE.WebGPURenderer {
  const renderer = new THREE.WebGPURenderer({ canvas: document.querySelector('canvas') as HTMLCanvasElement, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  return renderer;
}

export function loadMeshFromLink(path: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new OBJLoader();
    loader.load(
      path,
      (root) => {
        console.log("Children:", root.children);
        root.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshBasicMaterial({ color: 0x2f4f4f });
          }
        });
        resolve(root);
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
    console.error("Failed to load model:", error);
  }
}

//--------------LOAD ONTO GPUBUFFER--------------

export interface ModelBuffers {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer | null;
  color?: GPUBuffer;

  vertexCount: number;
  indexCount: number;
}

export interface Entity {
  mesh: ModelBuffers;
  modelMatrix: THREE.Matrix4
}

const createVertexBuffer = (
  gpu: webGPUData, 
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
  gpu: webGPUData, 
  triangles: THREE.BufferAttribute | null,
): GPUBuffer | null => {
  if (!triangles || !triangles.array || triangles.array.length === 0) {
    console.warn('No index data provided to createIndexBuffer');
    return null;
  }
  const buffer = gpu.device.createBuffer({
    size: triangles.array.length * 3 * Uint16Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true,
  });

  const mapping = new Uint16Array(buffer.getMappedRange());
  for (let i = 0; i < triangles.array.length; ++i) {
    const baseIndex = i * 3;
    mapping[baseIndex] = triangles.array[baseIndex];
    mapping[baseIndex + 1] = triangles.array[baseIndex + 1];
    mapping[baseIndex + 2] = triangles.array[baseIndex + 2];
  }
  buffer.unmap();
  return buffer;
};

export function getModelBuffersFromMesh(
  gpu: webGPUData, 
  mesh: THREE.Mesh
) : ModelBuffers {
  const meshes: ModelBuffers[] = [];
  const geometry = mesh.geometry;

  const positionAttribute = geometry.getAttribute('position');
  const vertexCount = positionAttribute.count;
  const normalAttribute = geometry.getAttribute('normal');

  let indexAttribute = geometry.getIndex();
  const indexCount = indexAttribute?.count || vertexCount;

  const vertexBuffer = createVertexBuffer(gpu, positionAttribute, normalAttribute);
  const indexBuffer = createIndexBuffer(gpu, indexAttribute);
  return {
    vertexBuffer, indexBuffer,
    vertexCount,
    indexCount
  };
}

export function getModelBuffers(
  gpu: webGPUData, 
  group: THREE.Group
) {
  const meshes: Entity[] = [];
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = getModelBuffersFromMesh(gpu, obj as THREE.Mesh);
      if(meshes) meshes.push({mesh, modelMatrix: obj.matrixWorld});
    }
  });
  return meshes;
}

export const vertexBuffers: Iterable<GPUVertexBufferLayout | null | undefined> = [{
  arrayStride: Float32Array.BYTES_PER_ELEMENT * 6,
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
}]