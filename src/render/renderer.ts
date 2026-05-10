import * as THREE from 'three/webgpu';

import {
    addCamera,
    CameraConfig,
    CameraType,
    isCameraChanged,
    setControls,
} from '../utils/camera-utils';
import { getWebGPU, logGPUBuffer, WebGPUData } from '../utils/webgpu-data';
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
    renderDepthPass,
    renderDepthPassResources,
} from './depth-map-debug';
import {
    createEntityFromGeometry,
    getModelBuffers,
    loadAndAddObject,
} from '../utils/loader';
import { DirectionalLight } from '../scene/light-types';
import { ApproxedGeometries, ComponentsMap, Entity, modelType, Scene, updateApproxedGeometries } from '../scene/scene-types';
import {
    cameraWhat,
    renderWhat,
    UI,
    UIChanged,
    UIConfig,
    UIFlags,
} from '../UI/UI-flags-types';
import { Circle, Path, TestScenePath } from '../scene/movement/path';

import carApprox from '../../public/assets/car_approx.json';
import { getApproximatedGeometry } from '../utils/get-sphere-approximator';
import { createOccluderBuffers, fillOccluderBuffers, OccluderBuffers } from '../config/occluder-buffer';
import { AnalyticPassResources, aPass, initAPass } from './analytic-shadow-pass';

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

// ----- DEBUG - MAKE A TEST SCENE ----- //
async function createTestScene(
    gpu: WebGPUData,
    mainConfig: CameraConfig,
    direction: THREE.Vector3
): Promise<Scene> {
    // light source
    const light = new DirectionalLight();
    light.direction = direction;

    // add object entities
    const obj = await loadAndAddObject('/assets/with_mechet.glb');
    if (obj) {
        obj.scale.setScalar(0.1);
        obj.position.set(0, 0, 0);
        obj.updateMatrixWorld(true);
    } else {
        throw new Error('NO OBJ!');
    }

    let staticEntities = getModelBuffers(gpu, obj, modelType.STATIC);
    if (!staticEntities) {
        console.warn('Models were not loaded.');
        staticEntities = [];
    }

    const plane = createEntityFromGeometry(
        gpu,
        new THREE.BoxGeometry(50, 45, 1),
        modelType.STATIC,
        new THREE.Vector3(0, -0.5, 0),
        new THREE.Euler(-Math.PI / 2, undefined, undefined),
        1.0
    );
    staticEntities.push(plane);

    let dynamicEntities = []
    const paths: Path[] = []

    // add car
    const car = await loadAndAddObject('/assets/low_poly_car.glb');
    const y = -0.1
    const carPath = TestScenePath();
    for(let i = 0; i < 5; i += 1) {
        let p = i % carPath.length;
        const pos = new THREE.Vector3(carPath[p].x, y, carPath[p].y);
        if (car) {
            car.scale.setScalar(0.01);
            car.position.set(pos.x, pos.y, pos.z);
            car.updateMatrixWorld(true);
        } else {
            throw new Error('NO CAR!');
        }
        const carMesh = getModelBuffers(
            gpu,
            car,
            modelType.DYNAMIC
        );
        dynamicEntities.push(carMesh[0]);
        const path = new Path(carMesh[0], carPath, p + 1, pos, 0, 0.1);
        paths.push(path);
    }


    return { staticEntities, dynamicEntities, light, paths, cameraConfig: mainConfig };
}

async function createDynamicTestScene(
    gpu: WebGPUData,
    mainConfig: CameraConfig,
    direction: THREE.Vector3
): Promise<Scene> {
    // light source
    const light = new DirectionalLight();
    light.direction = direction;

    // add object entities
    let staticEntities = [];
    let dynamicEntities = [];

    const plane = await createEntityFromGeometry(
        gpu,
        new THREE.BoxGeometry(50, 45, 1),
        modelType.STATIC,
        new THREE.Vector3(0, 0, 0),
        new THREE.Euler(-Math.PI / 2, undefined, undefined),
        1.0
    );
    staticEntities.push(plane);

    // add car
    const car = await loadAndAddObject('/assets/moped.glb');
    if (car) {
        car.scale.setScalar(0.05);
        car.position.set(0, 0, 0);
        car.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }

    const carMesh = await getModelBuffers(
        gpu,
        car,
        modelType.DYNAMIC,

    );
    dynamicEntities.push(carMesh[0]);

    const paths = [
        new Path(carMesh[0], Circle(), 0, new THREE.Vector3(0, 0, 0), 0, 0.1),
    ];

    return { staticEntities, dynamicEntities, light, paths, cameraConfig: mainConfig };
}

async function debugSpheresTestScene(
    gpu: WebGPUData,
    mainConfig: CameraConfig,
    direction: THREE.Vector3
): Promise<Scene> {
    // light source
    const light = new DirectionalLight();
    light.direction = direction;

    // add object entities
    let staticEntities = [];
    let dynamicEntities: Entity[] = [];

    // get first car
    let car = await loadAndAddObject('/assets/low_poly_car.glb');
    if (car) {
        car.scale.setScalar(0.01);
        car.position.set(0, -0.5, 0);
        car.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }
    const carMesh = await getModelBuffers(
        gpu,
        car,
        modelType.DYNAMIC,
        new THREE.Vector3(0, -0.5, 0),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    let approxedCar = getApproximatedGeometry(
        carApprox,
        new THREE.Vector3(0, -0.5, 0),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    approxedCar.model = approxedCar.model;

    updateApproxedGeometries();
    ApproxedGeometries.set(carMesh[0], approxedCar);
    dynamicEntities.push(carMesh[0]);

    // get second car
    car = await loadAndAddObject('/assets/low_poly_car.glb');
    if (car) {
        car.scale.setScalar(0.005);
        car.position.set(5, -0.5, 10);
        car.rotation.set(0.0, -Math.PI / 2, 0.0);
        car.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }
    const carMesh1 = await getModelBuffers(
        gpu,
        car,
        modelType.DYNAMIC,
        new THREE.Vector3(5, -0.5, 10),
        new THREE.Euler(0.0, -Math.PI / 2, 0.0),
        new THREE.Vector3(0.005, 0.005, 0.005)
    );
    const approxedCar1 = getApproximatedGeometry(
        carApprox,
        new THREE.Vector3(5, -0.5, 10),
        new THREE.Euler(0.0, -Math.PI / 2, 0.0),
        new THREE.Vector3(0.005, 0.005, 0.005)
    );
    approxedCar1.model = approxedCar.model;
    updateApproxedGeometries();
    ApproxedGeometries.set(carMesh1[0], approxedCar1);
    dynamicEntities.push(carMesh1[0]);

    // get the ground
    const plane = createEntityFromGeometry(
        gpu,
        new THREE.BoxGeometry(50, 50, 1),
        modelType.STATIC,
        new THREE.Vector3(2, -1, 2),
        new THREE.Euler(-Math.PI / 2, undefined, undefined),
        1.0
    );
    staticEntities.push(plane);

    const paths: Path[] = [
        // new Path(carMesh[0], Circle(), 0, new THREE.Vector3(0, 0, 0), 0, 0.05),
        // new Path(carMesh1[0], Circle(), 2, new THREE.Vector3(0, 0, 0), 0, 0.05),
    ];

    return { staticEntities, dynamicEntities, light, paths, cameraConfig: mainConfig };
}

async function createStaticTestScene(
    gpu: WebGPUData,
    mainConfig: CameraConfig,
    direction: THREE.Vector3
): Promise<Scene> {
    // light source
    const light = new DirectionalLight();
    light.direction = direction;

    // add object entities
    let staticEntities = [];
    let dynamicEntities: Entity[] = [];

    const plane = createEntityFromGeometry(
        gpu,
        new THREE.BoxGeometry(50, 45, 1),
        modelType.STATIC,
        new THREE.Vector3(0, 0, 0),
        new THREE.Euler(-Math.PI / 2, undefined, undefined),
        1.0
    );
    staticEntities.push(plane);

    // add car
    const car = await loadAndAddObject('/assets/low_poly_car.glb');
    if (car) {
        car.scale.setScalar(0.05);
        car.position.set(0, 0, 0);
        car.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }

    const carMesh = getModelBuffers(
        gpu,
        car,
        modelType.STATIC
    );

    const circle = createEntityFromGeometry(
        gpu,
        new THREE.SphereGeometry(1.01),
        modelType.STATIC,
        new THREE.Vector3(0, 1, 0),
        new THREE.Euler(0, 0, undefined),
        1.0
    );
    staticEntities.push(circle);

    // staticEntities.push(carMesh[0]);

    const paths: Path[] = [];

    return { staticEntities, dynamicEntities, light, paths, cameraConfig: mainConfig };
}

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
    let scene = await debugSpheresTestScene(
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
    // await logGPUBuffer(gpu, occluderBuffers.buffer, 1024)
    // await logGPUBuffer(gpu, occluderBuffers.modelMatrixBuffer, 128)
    // await logGPUBuffer(gpu, occluderBuffers.idBuffer, 128 * 2)

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
    var aPassResources = await initAPass(
        gpu,
        scene,
        sceneBuffers,
        occluderBuffers,
        sceneBuffers.cameraBuffer,
        configBuffer.configBuffer,
        depthPassResources.dynamicDepthMap
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
