import { ApproxedGeometries, Entity, getApproxedGeometriesCount, Scene } from "../scene/scene-types";
import { ApproxedGeometry } from "../utils/get-sphere-approximator";
import { WebGPUData } from "../utils/webgpu-data";

export type OccluderBuffers = {
  buffer: GPUBuffer;
  idBuffer: GPUBuffer;
  modelMatrixBuffer: GPUBuffer;
  outputBuffer: GPUBuffer;
  size: number;
  numOfOccluders: number;
};

const MAX_NUM_OCCLUDERS = 32.0;
const SPHERE_SIZE = 4;
const MODEL_MATRIX = 16 + 4;

export function createOccluderBuffers(
    gpu: WebGPUData,
    scene: Scene
) : OccluderBuffers {
    let number_of_approxed = getApproxedGeometriesCount(); // number of 
    let num_occluders = 0;
    for (const entity of scene.dynamicEntities) {
        const spheres = ApproxedGeometries.get(entity);

        if (!spheres) {
            console.warn("Entity " + entity.id + " does not have an approximated geometry.");
            continue;
        }
        num_occluders += spheres.model.length;
    }

    const size = number_of_approxed * num_occluders * SPHERE_SIZE * Float32Array.BYTES_PER_ELEMENT;

    const buffer = gpu.device.createBuffer({
        size: num_occluders * SPHERE_SIZE * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        label: "OccluderBuffer-Spheres" 
    });
    const idBuffer = gpu.device.createBuffer({
        size: 2 * num_occluders * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        label: "OccluderBuffer-Ids" 
    }); // where the model matrix is
    const modelMatrixBuffer = gpu.device.createBuffer({
        size: MODEL_MATRIX * number_of_approxed * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        label: "OccluderBuffer-Options" 
    });
    const outputBuffer = gpu.device.createBuffer({
        size: (100 * 100 * MAX_NUM_OCCLUDERS) * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        label: "OccluderOutputBuffer"
    });

    return {
        buffer, idBuffer, modelMatrixBuffer, outputBuffer, size, numOfOccluders: num_occluders
    };
}

export function fillOccluderBuffers(
    gpu: WebGPUData,
    buffers: OccluderBuffers,
    scene: Scene
) : OccluderBuffers {
    let number_of_approxed = getApproxedGeometriesCount(); // number of 
    const { buffer, modelMatrixBuffer, idBuffer, numOfOccluders } = buffers;
    const entities = scene.dynamicEntities;

    const sphereArray =  new Float32Array(numOfOccluders * SPHERE_SIZE);
    const idArray =  new Uint32Array(2 * numOfOccluders);
    const entitiesArray =  new Float32Array(number_of_approxed * MODEL_MATRIX);
    
    let occluderCount = 0;
    let approxedEntity = 0;

    for (let i = 0; i < entities.length; i++) {
        const spheres = ApproxedGeometries.get(entities[i]);

        if (!spheres) {
            console.warn("Entity " + entities[i].id + " does not have an approximated geometry.");
            continue;
        }

        entitiesArray.set(spheres.modelMatrix.toArray(), approxedEntity * MODEL_MATRIX);
        entitiesArray.set(spheres.scale.toArray(), approxedEntity * MODEL_MATRIX + 16);
        for(let j = 0; j < spheres.model.length; j++) {
            const sphere = spheres.model[j];
            const idx = occluderCount * SPHERE_SIZE;
            sphereArray.set([sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius], idx);
            idArray.set([approxedEntity, entities[i].id], occluderCount * 2);
            occluderCount++;
        }
        approxedEntity++;
    }

    gpu.device.queue.writeBuffer(
        buffer,
        0,
        sphereArray
    );
    gpu.device.queue.writeBuffer(
        modelMatrixBuffer,
        0,
        entitiesArray
    );
    gpu.device.queue.writeBuffer(
        idBuffer,
        0,
        idArray
    );

    return buffers;
}