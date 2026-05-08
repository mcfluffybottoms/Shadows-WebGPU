import { ApproxedGeometries, Entity, Scene } from "../scene/scene-types";
import { ApproxedGeometry } from "../utils/get-sphere-approximator";
import { WebGPUData } from "../utils/webgpu-data";

export type OccluderBuffers = {
  buffer: GPUBuffer;
  outputBuffer: GPUBuffer;
  size: number;
  numOfOccluders: number;
};

const MAX_NUM_OCCLUDERS = 64;
const OCCLUDER_STRIDE = 4;
const NUM_OF_FLOATS_MAX = MAX_NUM_OCCLUDERS * OCCLUDER_STRIDE;

export function createOccluderBuffers(
    gpu: WebGPUData
) : OccluderBuffers {
    const size = NUM_OF_FLOATS_MAX * Float32Array.BYTES_PER_ELEMENT;
    let entitieslength = 1;

    const buffer = gpu.device.createBuffer({
        size: size * entitieslength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        label: "OccluderBuffer" 
    });

    const outputBuffer = gpu.device.createBuffer({
        size: (100 * 100 *  (64 + 4)) * Float32Array.BYTES_PER_ELEMENT * entitieslength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        label: "OccluderOutputBuffer"
    });

    return {
        buffer, outputBuffer, size, numOfOccluders: MAX_NUM_OCCLUDERS
    };
}

export function fillOccluderBuffers(
    gpu: WebGPUData,
    buffers: OccluderBuffers,
    scene: Scene
) : OccluderBuffers {
    const { buffer } = buffers;

    const entities = scene.dynamicEntities;

    console.log(ApproxedGeometries);

    let entitieslength = 1;
    let occluderCount = 0;
    const dataArray =  new Float32Array(entitieslength * MAX_NUM_OCCLUDERS * OCCLUDER_STRIDE);
    for (let i = 0; i < entitieslength; i++) {
        const entity_ag = ApproxedGeometries.get(entities[i]);

        if (!entity_ag) {
            console.warn("Entity " + entities[i].id + " does not have an approximated geometry.");
            continue;
        }

        for(let j = 0; j < entity_ag.length; j++) {
            const sphere = entity_ag[j];
            // console.log(sphere);
            const idx = occluderCount * OCCLUDER_STRIDE;
            dataArray.set([sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius], idx);
            occluderCount++;
        }
    }
    console.log(dataArray);
    gpu.device.queue.writeBuffer(
        buffer,
        0,
        dataArray
    );

    return buffers;
}