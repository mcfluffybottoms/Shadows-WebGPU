import { WebGPUData } from "../utils/webgpu-data";

export type ConfigBuffers = {
  configBuffer: GPUBuffer;
  configBufferSize: number;
};

export function createConfigBuffers(
    gpu: WebGPUData
) : ConfigBuffers {
    const configBufferSize = 12 * Uint32Array.BYTES_PER_ELEMENT + 6 * Float32Array.BYTES_PER_ELEMENT;

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
    gpu: WebGPUData,
    buffers: ConfigBuffers,
    shadows: boolean,
    a_shadows: boolean,
    numberOfSamples: number,
    numberOfCascades: number,
    biasType: number,
    biasValue: number,
    lightOn: boolean,
    cascadeLayers: boolean,
    lightAmbient: number,
    coneAngle: number,
    hemisphereRadius: number,
    dirStrength: number,
    ambStrength: number,
    tilesX: number,
    tilesY: number,
    seeGrid: boolean,
    directionalOn: boolean,
    ambientOn: boolean
) : ConfigBuffers {
    const { configBuffer } = buffers;
    
    const dataArray = new ArrayBuffer(buffers.configBufferSize);
    const uint32View = new Uint32Array(dataArray);
    const float32View = new Float32Array(dataArray);
    
    uint32View[0] = shadows ? 1 : 0;
    uint32View[1] = a_shadows ? 1 : 0;
    uint32View[2] = numberOfSamples;
    uint32View[3] = numberOfCascades;
    uint32View[4] = biasType;
    uint32View[5] = lightOn ? 1 : 0;
    uint32View[6] = cascadeLayers ? 1 : 0;
    uint32View[7] = seeGrid ? 1 : 0;
    uint32View[8] = directionalOn ? 1 : 0;
    uint32View[9] = ambientOn ? 1 : 0;
    uint32View[10] = tilesX;
    uint32View[11] = tilesY;
    float32View[12] = biasValue;
    float32View[13] = lightAmbient;
    float32View[14] = coneAngle;
    float32View[15] = hemisphereRadius;
    float32View[16] = dirStrength;
    float32View[17] = ambStrength;
    

    gpu.device.queue.writeBuffer(configBuffer, 0, dataArray);
    
    return buffers;
}