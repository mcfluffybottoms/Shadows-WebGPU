import { Entity } from "../scene/scene-types";
import { ApproxedGeometry } from "../utils/get-sphere-approximator";
import { WebGPUData } from "../utils/webgpu-data";

export type OccluderBuffers = {
  buffer: GPUBuffer;
  size: number;
  numOfOccluders: number;
};

export function createOccluderBuffers(
    gpu: WebGPUData,
    entity: Entity,
    approxedFigure: ApproxedGeometry
) : OccluderBuffers {
    const size = approxedFigure.length * (4 * Float32Array.BYTES_PER_ELEMENT);

    const buffer = gpu.device.createBuffer({
        size: size,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "OccluderBuffer-" + entity.id
    });

    return {
        buffer, size, numOfOccluders: approxedFigure.length
    };
}

export function fillOccluderBuffers(
    gpu: WebGPUData,
    buffers: OccluderBuffers,
    approxedFigure: ApproxedGeometry
) : OccluderBuffers {
    const { buffer } = buffers;
    
    const dataArray = new Float32Array(buffers.size);

    for(let i = 0; i < approxedFigure.length; i++) {
        const sphere = approxedFigure[i];
        dataArray.set([sphere.radius, sphere.center.x, sphere.center.y, sphere.center.z], i);
    }
    
    gpu.device.queue.writeBuffer(buffer, 0, dataArray);
    
    return buffers;
}