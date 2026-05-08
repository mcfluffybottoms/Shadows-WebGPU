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
export type UIConfig = {
    renderWhat: renderWhat;
    cameraType: cameraWhat;
    direction: THREE.Vector3;
    depthPassSize: number;
    numOfCascades: number;
    depthMapCascade: number;
    cascadeLayers: boolean;
    lightOn: boolean;
    lightAmbient: number;
    shadowMap: boolean;
    numberOfSamples: number;
    biasType: number;
    biasValue: number;
    lambda: number;
    analyticShadowsOn: boolean;
    coneAngle: number;
    hemisphereRadius: number;
    dirStrength: number;
    ambStrength: number;
    tilesX: number;
    tilesY: number;
    seeGrid: boolean;
    directionalOn: boolean;
    ambientOn: boolean;
}
export let UI: UIConfig = {
    // change view
    renderWhat: renderWhat.scene,
    //camera
    cameraType: cameraWhat.Perspective,
    //light buffer
    direction: new THREE.Vector3(0.5, -0.5, 0.5),
    //reinit
    depthPassSize: 2048,
    numOfCascades: 4,
    //debug depthmap and shadows
    depthMapCascade: 1,
    cascadeLayers: false,
    //light
    lightOn: false,
    lightAmbient: 0.3,
    //shadows
    shadowMap: true,
    numberOfSamples: 4,
    biasType: 2,
    biasValue: 0.001,
    lambda: 0.7,
    // analytic shadows
    analyticShadowsOn: true,
    coneAngle: 15.0,
    hemisphereRadius: 1.0,
    dirStrength: 1.0,
    ambStrength: 1.0,
    tilesX: 50,
    tilesY: 50,
    seeGrid: false,
    directionalOn: true,
    ambientOn: true
};

export type UIFlags = {
    depthPassSize: boolean;
    numOfCascades: boolean;
    depthMapCascade: boolean;
    direction: boolean;
    cameraType: boolean;
    configChanged: boolean;
}

// dirty flags for reinit
export let UIFlags: UIFlags = {
    // UIChangedToReinit
    depthPassSize: true,
    numOfCascades: true,
    depthMapCascade: true,
    // UILightBufferChanged
    direction: true,
    // UICameraBufferChanged
    cameraType: true,
    // UIConfigChanged
    configChanged: true
};

export function UIChanged(flags: UIFlags) {
    return flags.depthPassSize || flags.numOfCascades || flags.depthMapCascade || flags.direction || flags.cameraType || flags.configChanged;
}