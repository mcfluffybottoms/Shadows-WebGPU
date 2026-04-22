import * as THREE from "three/webgpu";
import { ComponentsMap, Entity, Scene } from "./scene-types";
import { getVP } from "../utils/camera-utils";
import { WebGPUData } from "../utils/webgpu-data";
import { Split } from "./light-types";

export type SceneBuffers = {
  cameraBuffer: GPUBuffer;
  lightBuffer: GPUBuffer;
  snatchedLightBuffer: GPUBuffer;
  lightBufferOptions: GPUBuffer;
  staticObjectBuffer: GPUBuffer;
  dynamicObjectBuffer: GPUBuffer;
};

const OFFSET = 64 * Float32Array.BYTES_PER_ELEMENT;
const MAX_CASCADES = 8;

export function createSceneBuffers(
    gpu: WebGPUData,
    scene: Scene
) : SceneBuffers {
    const { staticEntities, dynamicEntities } = scene;

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
    const staticObjectBuffer = gpu.device.createBuffer({
        size: OFFSET * staticEntities.length,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "objectBuffer-shadowPass"
    }); // make it much smaller
    const dynamicObjectBuffer = gpu.device.createBuffer({
        size: OFFSET * dynamicEntities.length,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "objectBuffer-shadowPass"
    }); // make it much smaller

    return {
        cameraBuffer,
        lightBuffer,
        snatchedLightBuffer,
        staticObjectBuffer,
        dynamicObjectBuffer,
        lightBufferOptions
    };
}

type bufferToFill = {
    camera: boolean,
    light: boolean,
    staticObj: boolean,
    dynamicObj: boolean
}

export function fillSceneBuffers(
    gpu: WebGPUData,
    buffers: SceneBuffers,
    scene: Scene,
    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
    numOfCascades: number, 
    lightViewProjMatrix: THREE.Matrix4[],
    lightSplits: Split[],
    flags: bufferToFill
) : SceneBuffers {
    const { cameraBuffer, lightBuffer, snatchedLightBuffer, staticObjectBuffer, dynamicObjectBuffer, lightBufferOptions } = buffers;
    const { light, staticEntities, dynamicEntities } = scene;

    // camera buffer
    if(flags.camera) {
       const cameraMatrixArray =  new Float32Array(16 + 16 + 4);
        cameraMatrixArray.set(new Float32Array(getVP(camera).elements), 0);
        cameraMatrixArray.set(new Float32Array(camera.matrixWorldInverse.elements), 16);
        cameraMatrixArray.set([camera.position.x, camera.position.y, camera.position.z, 1.0], 16 + 16);
        gpu.device.queue.writeBuffer(cameraBuffer, 0, cameraMatrixArray); 
    }
    
    if(flags.light) {
        // light buffer
        const lightMatrixArray =  new Float32Array(64 * numOfCascades);
        for(var i = 0; i < numOfCascades; ++i) {
            lightMatrixArray.set(new Float32Array(lightViewProjMatrix[i].elements), 64 * i);
        }
        gpu.device.queue.writeBuffer(lightBuffer, 0, lightMatrixArray);

        // snatched light buffer
        const snatchedLightMatrixArray =  new Float32Array(16 * MAX_CASCADES);
        for(var i = 0; i < numOfCascades; ++i) {
            snatchedLightMatrixArray.set(new Float32Array(lightViewProjMatrix[i].elements), 16 * i);
        }
        gpu.device.queue.writeBuffer(snatchedLightBuffer, 0, snatchedLightMatrixArray);

        // light buffer options
        const lightMatrixOptionsArray =  new Float32Array(4 + 4 + 4 * numOfCascades);
        lightMatrixOptionsArray.set([light.direction.x, light.direction.y, light.direction.z, 1.0], 0);
        lightMatrixOptionsArray.set([light.direction.x, light.direction.y, light.direction.z, 1.0], 4);
        for(var i = 0; i < numOfCascades; ++i) {
            lightMatrixOptionsArray.set(new Float32Array([lightSplits[i].near, lightSplits[i].far, 1.0, 1.0]), 8 + 4 * i);
        }
        gpu.device.queue.writeBuffer(lightBufferOptions, 0, lightMatrixOptionsArray);
    }

    // object buffers
    const writeToObjectBuffer = (entities: Entity[], objectBuffer: GPUBuffer) => {
        const modelMatrixArray =  new Float32Array(entities.length * 64);
        for (let i = 0; i < entities.length; i++) {
            const entity_rc = ComponentsMap.get(entities[i])?.ModelComponent;
            if (!entity_rc) {
                console.warn("Entity " + entities[i].id + " does not have a render component present.");
                continue;
            }
            const { modelMatrix } = entity_rc;
            const normalMatrix = modelMatrix.clone().invert().transpose();
            modelMatrixArray.set(modelMatrix.toArray(), i * 64);
            modelMatrixArray.set(normalMatrix.toArray(), i * 64 + 16);
            modelMatrixArray[i * 64 + 16 + 16 + 1] = entities[i].id;
        }
        gpu.device.queue.writeBuffer(
            objectBuffer,
            0,
            modelMatrixArray
        );
    }

    if(flags.staticObj) {
        writeToObjectBuffer(staticEntities, staticObjectBuffer);
    }

    if(flags.dynamicObj) {
        writeToObjectBuffer(dynamicEntities, dynamicObjectBuffer);
    }

    return {
        snatchedLightBuffer,
        cameraBuffer,
        lightBuffer,
        staticObjectBuffer,
        dynamicObjectBuffer,
        lightBufferOptions
    };
}