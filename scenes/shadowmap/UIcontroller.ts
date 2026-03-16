import * as THREE from "three/webgpu";

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
    // change view
    renderWhat: renderWhat.scene,
    //camera
    cameraType: cameraWhat.Perspective,
    //light buffer
    direction: new THREE.Vector3(0.5, -0.5, 0.5),
    //reinit
    depthPassSize: 1024,
    numOfCascades: 4,
    //debug depthmap and shadows
    depthMapCascade: 1,
    cascadeLayers: true,
    //light
    lightOn: true,
    lightAmbient: 0.3,
    //shadows
    shadowMap: true,
    numberOfSamples: 4,
    biasType: 2,
    biasValue: 0.003,
};

// dirty flags for reinit
export let UIChangedToReinit = {
    depthPassSize: true,
    numOfCascades: true,
    depthMapCascade: true,
};

// dirty flags for light
export let UILightBufferChanged = {
    direction: true,
};

// dirty flags for camera
export let UICameraBufferChanged = {
    cameraType: true,
};

export let UIConfigChanged = {
    configChanged: true
};

// reset flags to  true
export function resetFlags(UIChanged: any) {
    const keys = Object.keys(UIChanged);
    keys.forEach(key => {
        UIChanged[key] = false;
    });
}

export function resetAllFlags() {
    resetFlags(UIChangedToReinit);
    resetFlags(UILightBufferChanged);
    resetFlags(UICameraBufferChanged);
    resetFlags(UIConfigChanged);
}