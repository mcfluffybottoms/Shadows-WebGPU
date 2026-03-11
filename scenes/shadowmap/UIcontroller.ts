import * as THREE from "three/webgpu";

import { OrbitControls } from "three/examples/jsm/Addons.js";
import { ConfigBuffers, fillConfigBuffers } from "../../src/config/config-buffers";
import { webGPUData } from "../../src/utils/webgpu-data";

export enum renderWhat {
    depthMap,
    scene
}
export enum controllingWhat {
    camera,
    light
}
export enum cameraWhat {
    Orthographic,
    Perspective
}

// global data config to store changes to UI
export let UI = {
    renderWhat: renderWhat.scene,
    cameraWhat: cameraWhat.Perspective,
    shadowMap: true,
    lightOn: true,
    cascadeLayers: true,
    numberOfSamples: 4,
    depthPassSize: 1024,
    numOfCascades: 4,
    depthMapCascade: 1,
    direction: new THREE.Vector3(0.5, -0.5, 0.5),
    biasType: 0,
    biasValue: 0.001,
    lightAmbient: 0.7,
};
// dirty flags
export let UIchanged = {
    controllingWhat: true,
    cameraWhat: true,
    configChanged: true,
    depthPassSizeChanged: false,
    numOfCascadesChanged: false,
    directionChanged: true,
};

export function changeConfig(gpu: webGPUData, buffers: ConfigBuffers) : boolean {
    if(!UIchanged.configChanged) return false;
    fillConfigBuffers(
        gpu, 
        buffers, 
        UI.shadowMap, 
        UI.numberOfSamples, 
        UI.numOfCascades, 
        UI.biasType, 
        UI.biasValue,
        UI.lightOn,
        UI.cascadeLayers,
        UI.lightAmbient
    );
    return true;
}