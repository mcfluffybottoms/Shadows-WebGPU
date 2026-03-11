import { webGPUData } from "../utils/webgpu-data";

export type ConfigBuffers = {
  configBuffer: GPUBuffer;
  configBufferSize: number;
};

export function createConfigBuffers(
    gpu: webGPUData
) : ConfigBuffers {
    const configBufferSize = 6 * Uint32Array.BYTES_PER_ELEMENT + 2 * Float32Array.BYTES_PER_ELEMENT;

    const configBuffer = gpu.device.createBuffer({
        size: configBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "configBuffer"
    });

    return {
        configBuffer, configBufferSize
    };
}

export function fillConfigBuffers(
    gpu: webGPUData,
    buffers: ConfigBuffers,
    shadows: boolean,
    numberOfSamples: number,
    numberOfCascades: number,
    biasType: number,
    biasValue: number,
    lightOn: boolean,
    cascadeLayers: boolean,
    lightAmbient: number
) : ConfigBuffers {
    const { configBuffer } = buffers;
    
    const dataArray = new ArrayBuffer(buffers.configBufferSize);
    const uint32View = new Uint32Array(dataArray);
    const float32View = new Float32Array(dataArray);
    
    uint32View[0] = shadows ? 1 : 0;
    uint32View[1] = numberOfSamples;
    uint32View[2] = numberOfCascades;
    uint32View[3] = biasType;
    uint32View[4] = lightOn ? 1 : 0;
    uint32View[5] = cascadeLayers ? 1 : 0;
    float32View[6] = biasValue;
    float32View[7] = lightAmbient;
    
    gpu.device.queue.writeBuffer(configBuffer, 0, dataArray);
    
    return buffers;
}