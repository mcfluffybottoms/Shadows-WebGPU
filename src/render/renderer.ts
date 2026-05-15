import * as THREE from 'three/webgpu';

import {
    addCamera,
    CameraConfig,
    CameraType,
    isCameraChanged,
    setControls,
} from '../utils/camera-utils';
import { getWebGPU, WebGPUData } from '../utils/webgpu-data';
import {
    ConfigBuffers,
    createConfigBuffers,
    fillConfigBuffers,
} from '../config/config-buffers';
import {
    DepthMap,
    depthPass,
    depthPassAll,
    DepthPassResources,
    initDepthPass,
    onDepthMapChange,
    onDepthMapLightChange,
} from './depth-pass';
import {
    createSceneBuffers,
    fillSceneBuffers,
    SceneBuffers,
} from '../scene/scene-buffers';
import {
    initRenderPass,
    onRenderPassDepthMapChange,
    RenderPass,
    RenderPassResources,
} from './render-pass';
import {
    initRenderDepthPass,
    renderDepthPass
} from './depth-map-debug';
import { GeometryToPrecompute, PrecomputedGeometry, Scene } from '../scene/scene-types';
import {
    cameraWhat,
    renderWhat,
    UI,
    UIChanged,
    UIConfig,
    UIFlags,
} from '../UI/UI-flags-types';
import { createOccluderBuffers, fillOccluderBuffers, OccluderBuffers } from '../config/occluder-buffer';
import { AnalyticPassResources, aPass, initAPass } from './analytic-shadow-pass';
import { createLastTestScene, debugTwoApproxedCars, sceneWithOneSphere } from './scene-creator';
import { PrecomputeOccluders } from './precompute/precompute-occluded';

export type RenderInfo = {
    // device config
    gpu: WebGPUData;
    // scene abstractions
    scene: Scene;
    // buffers
    sceneBuffers: SceneBuffers;
    configBuffers: ConfigBuffers;
    occluderBuffers: OccluderBuffers;
    // render resources
    depthPassResources: DepthPassResources;
    renderPassResources: RenderPassResources;
    aPassResources: AnalyticPassResources;
    depthPassForAPassResources: DepthPassResources;
};

// ----- INIT RENDER INFO ----- //
export async function initRender(
    UI: UIConfig,
    flags: UIFlags
): Promise<RenderInfo> {
    const gpu = await getWebGPU();

    // camera
    let perspectiveCamera = addCamera(gpu.canvas, CameraType.Perspective);
    let mainConfig: CameraConfig = {
        camera: perspectiveCamera,
        controls: setControls(gpu.canvas, perspectiveCamera),
        lastMatrix: perspectiveCamera.matrixWorldInverse.clone(),
    };

    // get test scene
    let scene = await createLastTestScene(
        gpu,
        mainConfig,
        UI.direction
    );

    // load view proj matrices
    const { viewProjMatrix, splits } = scene.light.getNewViewProjMatrix(
        scene.cameraConfig.camera,
        UI.numOfCascades,
        UI.depthPassSize,
        UI.lambda
    );

    // create and load scene buffers
    const sceneBuffers = createSceneBuffers(gpu, scene);
    const configBuffer = createConfigBuffers(gpu);
    const occluderBuffers = createOccluderBuffers(gpu, scene);
    fillConfigBuffers(
        gpu,
        configBuffer,
        UI.shadowMap,
        UI.analyticShadowsOn,
        UI.numberOfSamples,
        UI.numOfCascades,
        UI.biasType,
        UI.biasValue,
        UI.lightOn,
        UI.cascadeLayers,
        UI.lightAmbient,
        UI.coneAngle,
        UI.hemisphereRadius,
        UI.dirStrength,
        UI.ambStrength,
        UI.tilesX,
        UI.tilesY,
        UI.seeGrid,
        UI.directionalOn,
        UI.ambientOn
    );
    fillSceneBuffers(
        gpu,
        sceneBuffers,
        scene,
        mainConfig.camera,
        UI.numOfCascades,
        viewProjMatrix,
        splits,
        { camera: true, light: true, staticObj: true, dynamicObj: true }
    );
    if (UI.analyticShadowsOn) fillOccluderBuffers(
        gpu,
        occluderBuffers,
        scene,
        { objects: true, model: true }
    );

    // create resources
    var depthPassResources = await initDepthPass(
        gpu,
        scene,
        sceneBuffers.lightBuffer,
        sceneBuffers.staticObjectBuffer,
        sceneBuffers.dynamicObjectBuffer,
        configBuffer,
        UI.depthPassSize,
        UI.numOfCascades
    );
    var renderPassResources = await initRenderPass(
        gpu,
        scene,
        depthPassResources.staticDepthMap,
        depthPassResources.dynamicDepthMap,
        sceneBuffers,
        configBuffer,
        occluderBuffers
    );
    var depthPassForAPassResources = await initDepthPass(
        gpu,
        scene,
        sceneBuffers.cameraBuffer,
        sceneBuffers.staticObjectBuffer,
        sceneBuffers.dynamicObjectBuffer,
        configBuffer,
        512,
        1
    );
    var aPassResources = await initAPass(
        gpu,
        scene,
        sceneBuffers,
        occluderBuffers,
        sceneBuffers.cameraBuffer,
        configBuffer.configBuffer,
        depthPassForAPassResources.dynamicDepthMap
    );

    let renderData = {
        gpu: gpu,
        mainConfig: mainConfig,
        scene: scene,
        sceneBuffers: sceneBuffers,
        configBuffers: configBuffer,
        occluderBuffers: occluderBuffers,
        depthPassResources: depthPassResources,
        renderPassResources: renderPassResources,
        aPassResources: aPassResources,
        depthPassForAPassResources: depthPassForAPassResources
    };

    updateRenderFromUI(renderData, UI, flags);


    // get preoccluded data
    for (const entity of GeometryToPrecompute) {
        const encoder = renderData.gpu.device.createCommandEncoder();
        const texture = PrecomputeOccluders(
            gpu, encoder, scene, sceneBuffers, configBuffer, occluderBuffers, entity);
        renderData.gpu.device.queue.submit([encoder.finish()]);
        PrecomputedGeometry.set(entity, await texture);
    }
    return renderData;
}

// ----- UPDATE RENDER FROM UI ----- //
export async function updateRenderFromUI(
    renderData: RenderInfo,
    UI: UIConfig,
    flags: UIFlags
) {
    const changed = UIChanged(flags);
    //load config
    if (flags.configChanged) {
        fillConfigBuffers(
            renderData.gpu,
            renderData.configBuffers,
            UI.shadowMap,
            UI.analyticShadowsOn,
            UI.numberOfSamples,
            UI.numOfCascades,
            UI.biasType,
            UI.biasValue,
            UI.lightOn,
            UI.cascadeLayers,
            UI.lightAmbient,
            UI.coneAngle,
            UI.hemisphereRadius,
            UI.dirStrength,
            UI.ambStrength,
            UI.tilesX,
            UI.tilesY,
            UI.seeGrid,
            UI.directionalOn,
            UI.ambientOn
        );
    }

    // change camera if needed
    if (flags.cameraType) {
        renderData.scene.cameraConfig.controls.disconnect();
        if (UI.cameraType == cameraWhat.Orthographic) {
            renderData.scene.cameraConfig.camera = addCamera(
                renderData.gpu.canvas,
                CameraType.Orthographic
            );
            renderData.scene.cameraConfig.controls = setControls(
                renderData.gpu.canvas,
                renderData.scene.cameraConfig.camera
            );
        } else {
            renderData.scene.cameraConfig.camera = addCamera(
                renderData.gpu.canvas,
                CameraType.Perspective
            );
            renderData.scene.cameraConfig.controls = setControls(
                renderData.gpu.canvas,
                renderData.scene.cameraConfig.camera
            );
        }
        renderData.scene.cameraConfig.controls.connect(renderData.gpu.canvas);
        flags.cameraType = false;

        renderData.scene.cameraConfig.controls.update();
    }

    // load light data
    if (flags.direction) {
        renderData.scene.light.direction = UI.direction;
        flags.direction = false;
    }

    // reinit
    if (flags.depthPassSize || flags.numOfCascades) {
        onDepthMapChange(
            renderData.gpu,
            renderData.depthPassResources,
            UI.depthPassSize,
            UI.numOfCascades
        );
        onDepthMapLightChange(
            renderData.gpu,
            renderData.depthPassResources,
            renderData.sceneBuffers.lightBuffer,
            UI.numOfCascades
        );
        onRenderPassDepthMapChange(
            renderData.gpu,
            renderData.renderPassResources,
            renderData.scene,
            renderData.depthPassResources.staticDepthMap,
            renderData.depthPassResources.dynamicDepthMap,
            renderData.sceneBuffers
        );
        flags.depthPassSize = false;
        flags.numOfCascades = false;
    }

    // debug option
    if (flags.depthMapCascade) {
        flags.depthMapCascade = false;
    }

    return changed;
}

export async function getMainTexture(
    renderData: RenderInfo,
    encoder: GPUCommandEncoder,
    option: renderWhat
) {
    let { gpu, renderPassResources, scene } =
        renderData;
    if (option == renderWhat.depthMap) {
        let map: DepthMap | undefined = undefined;
        switch (UI.depthMapType) {
            case 0:
                map = renderData.depthPassResources.staticDepthMap;
                break;
            case 1:
                map = renderData.depthPassResources.dynamicDepthMap;
                break;
            case 2:
                map = renderData.depthPassForAPassResources.dynamicDepthMap;
                break;
            default:
                console.warn('Unknown depth map type:', UI.depthMapType);
        }
        if(map == undefined) {
            return;
        }
        var renderDepthPassResources = await initRenderDepthPass(gpu, map, UI.depthMapCascade);
        await renderDepthPass(renderDepthPassResources, gpu, encoder);
    } else {
        await RenderPass(renderPassResources, gpu, encoder, scene);
    }
}


export async function renderFrame(
    renderData: RenderInfo,
    UI: UIConfig,
    flags: UIFlags
) {
    const uiChanged = await updateRenderFromUI(renderData, UI, flags);

    const encoder = renderData.gpu.device.createCommandEncoder();

    const cameraChanged = isCameraChanged(renderData.scene.cameraConfig);

    const { viewProjMatrix, splits } = renderData.scene.light.getNewViewProjMatrix(
        renderData.scene.cameraConfig.camera,
        UI.numOfCascades,
        UI.depthPassSize,
        UI.lambda
    );

    fillSceneBuffers(
        renderData.gpu,
        renderData.sceneBuffers,
        renderData.scene,
        renderData.scene.cameraConfig.camera,
        UI.numOfCascades,
        viewProjMatrix,
        splits,
        { camera: cameraChanged, light: true, staticObj: false, dynamicObj: true }
    );

    if(UI.analyticShadowsOn) fillOccluderBuffers(
        renderData.gpu,
        renderData.occluderBuffers,
        renderData.scene,
        { objects: true, model: uiChanged }
    );

    if(renderData.scene.staticEntities.length > 0 && UI.shadowMap && (cameraChanged || uiChanged)) await depthPass(
        renderData.depthPassResources,
        encoder,
        renderData.scene,
        UI.numOfCascades,
        true
    );

    if(UI.shadowMap) await depthPass(
        renderData.depthPassResources,
        encoder,
        renderData.scene,
        UI.numOfCascades,
        false
    );

    if(UI.analyticShadowsOn) {
        await depthPassAll(
            renderData.depthPassForAPassResources,
            encoder,
            renderData.scene,
            1.0
        );
        await aPass(
            renderData.aPassResources,
            encoder,
            renderData.scene
        );
    }

    await getMainTexture(renderData, encoder, UI.renderWhat);
    renderData.gpu.device.queue.submit([encoder.finish()]);

    renderData.scene.cameraConfig.controls.update();
}
function debugSphere(gpu: WebGPUData, mainConfig: CameraConfig, direction: THREE.Vector3) {
    throw new Error('Function not implemented.');
}
