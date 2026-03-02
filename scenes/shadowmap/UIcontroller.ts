import * as THREE from "three/webgpu";

import { OrbitControls } from "three/examples/jsm/Addons.js";
import { LightControls } from "../../src/scene/light-types";
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
    controllingWhat: controllingWhat.camera,
    cameraWhat: cameraWhat.Perspective,
    shadowMap: true,
    numberOfSamples: 4,
    depthPassSize: 1024,
    numOfCascades: 4,
};
// dirty flags
export let UIchanged = {
    controllingWhat: true,
    cameraWhat: true,
    configChanged: true,
    depthPassSizeChanged: false,
    numOfCascadesChanged: false,
};


export function changeControls(mainControls: OrbitControls, lightControls: LightControls, canvas: HTMLCanvasElement) : boolean {
    if(!UIchanged.controllingWhat) return false;
    mainControls.disconnect();
    lightControls.disconnect();
    if (UI.controllingWhat == controllingWhat.camera) {
        mainControls.connect(canvas);
    } else {
        lightControls.connect(canvas);
    }
    return true;
}

export function changeConfig(gpu: webGPUData, buffers: ConfigBuffers) : boolean {
    if(!UIchanged.configChanged) return false;
    fillConfigBuffers(gpu, buffers, UI.shadowMap, UI.numberOfSamples, UI.numOfCascades);
    return true;
}