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
    depthPass,
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
import { ApproxedGeometries, ComponentsMap, Entity, modelType, Scene } from '../scene/scene-types';
import {
    cameraWhat,
    renderWhat,
    UIChanged,
    UIConfig,
    UIFlags,
} from '../UI/UI-flags-types';
import { Circle, Path, TestScenePath } from '../scene/movement/path';

import carApprox from '../../public/assets/car_approx.json';
import { getApproximatedGeometry } from '../utils/get-sphere-approximator';

export type RenderInfo = {
    // device config
    gpu: WebGPUData;
    // scene abstractions
    scene: Scene;
    // buffers
    sceneBuffers: SceneBuffers;
    configBuffers: ConfigBuffers;
    // render resources
    depthPassResources: DepthPassResources;
    renderPassResources: RenderPassResources;
    renderDepthPassResources: renderDepthPassResources;
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
        //if(!carM) break;
        let p = i % carPath.length;
        const pos = new THREE.Vector3(carPath[p].x, y, carPath[p].y);
        //let car: THREE.Group<THREE.Object3DEventMap> = new THREE.Group();
        //car.copy(carM);
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
        modelType.DYNAMIC
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

    const approxedCar = getApproximatedGeometry(carApprox);
    
    ApproxedGeometries.set(carMesh[0], approxedCar);
    const scale = 0.01;
    console.log(approxedCar)
    for(const sphere of approxedCar) {
        const sphereMesh = createEntityFromGeometry(
            gpu,
            new THREE.SphereGeometry(sphere.radius),
            modelType.STATIC,
            new THREE.Vector3(sphere.center.x * scale, sphere.center.y * scale + 1, sphere.center.z * scale),
            new THREE.Euler(0, 0, undefined),
            scale
        );
        console.log(ComponentsMap.get(sphereMesh));
        staticEntities.push(sphereMesh);
    }

    // staticEntities.push(carMesh[0]);

    const paths: Path[] = [];

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
        UI.hemisphereRadius
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
        configBuffer
    );
    var renderDepthPassResources = await initRenderDepthPass(
        gpu,
        depthPassResources.staticDepthMap,
        UI.depthMapCascade
    );

    let renderData = {
        gpu: gpu,
        mainConfig: mainConfig,
        scene: scene,
        sceneBuffers: sceneBuffers,
        configBuffers: configBuffer,
        depthPassResources: depthPassResources,
        renderPassResources: renderPassResources,
        renderDepthPassResources: renderDepthPassResources,
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
            UI.hemisphereRadius
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
        renderData.renderDepthPassResources = await initRenderDepthPass(
            renderData.gpu,
            renderData.depthPassResources.staticDepthMap,
            UI.depthMapCascade
        );
        flags.depthMapCascade = false;
    }

    return changed;
}

export async function getMainTexture(
    renderData: RenderInfo,
    encoder: GPUCommandEncoder,
    option: renderWhat
) {
    let { gpu, renderDepthPassResources, renderPassResources, scene } =
        renderData;
    if (option == renderWhat.depthMap) {
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

    if(cameraChanged || uiChanged) await depthPass(
        renderData.depthPassResources,
        encoder,
        renderData.scene,
        UI.numOfCascades,
        true
    );

    await depthPass(
        renderData.depthPassResources,
        encoder,
        renderData.scene,
        UI.numOfCascades,
        false
    );

    await getMainTexture(renderData, encoder, UI.renderWhat);
    renderData.gpu.device.queue.submit([encoder.finish()]);

    renderData.scene.cameraConfig.controls.update();
}
