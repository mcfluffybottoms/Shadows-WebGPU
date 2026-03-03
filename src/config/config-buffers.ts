import { webGPUData } from "../utils/webgpu-data";

export type ConfigBuffers = {
  configBuffer: GPUBuffer;
  configBufferSize: number;
};

export function createConfigBuffers(
    gpu: webGPUData
) : ConfigBuffers {
    //turn shadows on off
    //number of samples

    const configBuffer = gpu.device.createBuffer({
        size: 4 * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "shadowsOnOff-NumberOfSamples"
    });

    const configBufferSize = 4 * Uint32Array.BYTES_PER_ELEMENT;

    return {
        configBuffer, configBufferSize
    };
}

export function fillConfigBuffers(
    gpu: webGPUData,
    buffers: ConfigBuffers,
    shadows: boolean,
    numberOfSamples: number,
    numberOfCascades: number
) : ConfigBuffers {
    const { configBuffer, configBufferSize } = buffers;
    // camera buffer
    const dataArray =  new Uint32Array(3);
    const shadowsInt = shadows ? 1 : 0;
    dataArray[0] = shadowsInt;
    dataArray[1] = numberOfSamples;
    dataArray[2] = numberOfCascades;
    gpu.device.queue.writeBuffer(configBuffer, 0, dataArray);

    return {
        configBuffer, configBufferSize
    };
}