import { Scene } from "./scene-types";
import { getVP } from "../utils/camera-utils";
import { webGPUData } from "../utils/webgpu-data";

export type SceneBuffers = {
  cameraBuffer: GPUBuffer;
  lightBuffer: GPUBuffer;
  snatchedLightBuffer: GPUBuffer;
  lightBufferOptions: GPUBuffer;
  objectBuffer: GPUBuffer;
};

const OFFSET = 64 * Float32Array.BYTES_PER_ELEMENT;
const MAX_CASCADES = 8;

export function createSceneBuffers(
    gpu: webGPUData,
    scene: Scene,
) : SceneBuffers {
    const { entities } = scene;

    const cameraBuffer = gpu.device.createBuffer({
        size: (16 + 16 + 4) * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "cameraBuffer-shadowPass"
    });
    const lightBuffer = gpu.device.createBuffer({
        size: OFFSET * MAX_CASCADES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "lightBuffer-shadowPass"
    });
    const snatchedLightBuffer = gpu.device.createBuffer({
        size: 16 * Float32Array.BYTES_PER_ELEMENT * MAX_CASCADES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "snatchedLightBuffer-shadowPass"
    });
    const lightBufferOptions = gpu.device.createBuffer({
        size: (4 + 4 + 4 * MAX_CASCADES) * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "lightBufferOptions-shadowPass"
    });
    const objectBuffer = gpu.device.createBuffer({
        size: OFFSET * entities.length,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "objectBuffer-shadowPass"
    });

    return {
        cameraBuffer,
        lightBuffer,
        snatchedLightBuffer,
        objectBuffer,
        lightBufferOptions
    };
}

export function fillSceneBuffers(
    gpu: webGPUData,
    buffers: SceneBuffers,
    scene: Scene,
    numOfCascades: number
) : SceneBuffers {
    const { cameraBuffer, lightBuffer, snatchedLightBuffer, objectBuffer, lightBufferOptions } = buffers;
    const { light, entities, camera } = scene;

    // camera buffer
    const cameraMatrixArray =  new Float32Array(16 + 16 + 4);
    cameraMatrixArray.set(new Float32Array(getVP(camera).elements), 0);
    cameraMatrixArray.set(new Float32Array(camera.matrixWorldInverse.elements), 16);
    cameraMatrixArray.set([camera.position.x, camera.position.y, camera.position.z, 1.0], 16 + 16);
    gpu.device.queue.writeBuffer(cameraBuffer, 0, cameraMatrixArray);

    // light buffer
    const lightMatrixArray =  new Float32Array(64 * numOfCascades);
    for(var i = 0; i < numOfCascades; ++i) {
        lightMatrixArray.set(new Float32Array(light.viewProjMatrix[i].elements), 64 * i);
    }
    gpu.device.queue.writeBuffer(lightBuffer, 0, lightMatrixArray);

    // snatched light buffer
    const snatchedLightMatrixArray =  new Float32Array(16 * MAX_CASCADES);
    for(var i = 0; i < numOfCascades; ++i) {
        snatchedLightMatrixArray.set(new Float32Array(light.viewProjMatrix[i].elements), 16 * i);
    }
    gpu.device.queue.writeBuffer(snatchedLightBuffer, 0, snatchedLightMatrixArray);

    // light buffer options
    const lightMatrixOptionsArray =  new Float32Array(4 + 4 + 4 * numOfCascades);
    lightMatrixOptionsArray.set([light.direction.x, light.direction.y, light.direction.z, 1.0], 0);
    lightMatrixOptionsArray.set([light.direction.x, light.direction.y, light.direction.z, 1.0], 4);
    for(var i = 0; i < numOfCascades; ++i) {
        lightMatrixOptionsArray.set(new Float32Array([light.splits[i].near, light.splits[i].far, 1.0, 1.0]), 8 + 4 * i);
    }
    gpu.device.queue.writeBuffer(lightBufferOptions, 0, lightMatrixOptionsArray);

    // object buffers
    const modelMatrixArray =  new Float32Array(entities.length * 64);
    for (let i = 0; i < entities.length; i++) {
        const modelMatrix = entities[i].modelMatrix;
        const normalMatrix = modelMatrix.clone().invert().transpose();
        modelMatrixArray.set(modelMatrix.toArray(), i * 64);
        modelMatrixArray.set(normalMatrix.toArray(), i * 64 + 16);
    }
    gpu.device.queue.writeBuffer(
        objectBuffer,
        0,
        modelMatrixArray
    );

    return {
        snatchedLightBuffer,
        cameraBuffer,
        lightBuffer,
        objectBuffer,
        lightBufferOptions
    };
}