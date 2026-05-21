import { ApproxedGeometries, Entity, getApproxedGeometriesCount, Scene } from "../scene/scene-types";
import { ApproxedGeometry } from "../utils/get-sphere-approximator";
import { WebGPUData } from "../utils/webgpu-data";

type OccluderInfo = {
    numberOfSpheres: number,
    offset: number,
    modelMatrixOffset: number
}

export type OccluderBuffers = {
  buffer: GPUBuffer;
  idBuffer: GPUBuffer;
  modelMatrixBuffer: GPUBuffer;
  outputBuffer: GPUBuffer;
  size: number;
  numOfOccluders: number;
  occluderInfos: Map<Entity, OccluderInfo>;
};

const MAX_NUM_OCCLUDERS = 256.0;
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

    if(number_of_approxed == 0) {
        num_occluders = 1;
        number_of_approxed = 1;
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
        size: (250 * 250 * MAX_NUM_OCCLUDERS * 4) * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        label: "OccluderOutputBuffer"
    });

    const occluderInfos = new Map();

    return {
        buffer, idBuffer, modelMatrixBuffer, outputBuffer, size, numOfOccluders: num_occluders, occluderInfos
    };
}

export function fillOccluderBuffers(
    gpu: WebGPUData,
    buffers: OccluderBuffers,
    scene: Scene,
    flags: {objects: boolean, model: boolean}
) : OccluderBuffers {
    let number_of_approxed = getApproxedGeometriesCount(); // number of 
    const { buffer, modelMatrixBuffer, idBuffer, numOfOccluders, occluderInfos } = buffers;
    const entities = scene.dynamicEntities;

    const sphereArray =  new Float32Array(numOfOccluders * SPHERE_SIZE);
    const idArray =  new Uint32Array(2 * numOfOccluders);
    const entitiesArray =  new Float32Array(number_of_approxed * MODEL_MATRIX);
    
    let occluderCount = 0;
    let approxedEntity = 0;

    occluderInfos.clear();

    for (let i = 0; i < entities.length; i++) {
        const spheres = ApproxedGeometries.get(entities[i]);
        
        if (!spheres) {
            console.warn("Entity " + entities[i].id + " does not have an approximated geometry.");
            continue;
        }

        occluderInfos.set(entities[i], { 
            numberOfSpheres: spheres.model.length,
            offset: occluderCount,
            modelMatrixOffset: approxedEntity
        });
        
        if (flags.objects) {
            entitiesArray.set(spheres.modelMatrix.toArray(), approxedEntity * MODEL_MATRIX);
            entitiesArray.set(spheres.scale.toArray(), approxedEntity * MODEL_MATRIX + 16);
        }
        
        if (flags.model) {
            for(let j = 0; j < spheres.model.length; j++) {
                const sphere = spheres.model[j];
                const idx = occluderCount * SPHERE_SIZE;
                sphereArray.set([sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius], idx);
                idArray.set([approxedEntity, entities[i].id], occluderCount * 2);
                occluderCount++;
            }
        }

        approxedEntity++;
    }
    if (flags.model) {
        gpu.device.queue.writeBuffer(
            buffer,
            0,
            sphereArray
        );
        gpu.device.queue.writeBuffer(
            idBuffer,
            0,
            idArray
        );
    }
    if (flags.objects) {
        gpu.device.queue.writeBuffer(
            modelMatrixBuffer,
            0,
            entitiesArray
        );
    }

    return buffers;
}