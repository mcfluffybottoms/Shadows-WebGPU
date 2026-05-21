import * as THREE from 'three/webgpu';

import {
    CameraConfig,
} from '../utils/camera-utils';
import { WebGPUData } from '../utils/webgpu-data';
import {
    createEntityFromGeometry,
    getModelBuffers,
    loadAndAddObject,
} from '../utils/loader';
import { DirectionalLight } from '../scene/light-types';
import { ApproxedGeometries, ComponentsMap, Entity, modelType, Scene, updateApproxedGeometries } from '../scene/scene-types';
import { Circle, Path, TestScenePath } from '../scene/movement/path';
import carApprox from '../../public/assets/car_approx.json';
import sphereApprox from '../../public/assets/sphere.json';
import retepApprox from '../../public/assets/retep.json';
import catApprox from '../../public/assets/cat.json';
import { getApproximatedGeometry } from '../utils/get-sphere-approximator';

export async function createLastTestScene(
    gpu: WebGPUData,
    mainConfig: CameraConfig,
    direction: THREE.Vector3
): Promise<Scene> {
    // light source
    const light = new DirectionalLight();
    light.direction = direction;

    // add static buildings
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

    // add plane
    const plane = createEntityFromGeometry(
        gpu,
        new THREE.BoxGeometry(60, 60, 1),
        modelType.STATIC,
        new THREE.Vector3(0, -0.5, 0),
        new THREE.Euler(-Math.PI / 2, undefined, undefined),
        1.0
    );
    staticEntities.push(plane);

    let dynamicEntities = []
    const paths: Path[] = []

    // add models
    dynamicEntities.push(await loadCat(
        gpu, 
        new THREE.Vector3(5, 0.0, 14),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.1, 0.1, 0.1)
    ));
    dynamicEntities.push(await loadCat(
        gpu, 
        new THREE.Vector3(20, 0.0, 4),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.1, 0.1, 0.1)
    ));
    dynamicEntities.push(await loadCat(
        gpu, 
        new THREE.Vector3(-15, 0.0, 13),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.1, 0.1, 0.1)
    ));
    dynamicEntities.push(await loadCat(
        gpu, 
        new THREE.Vector3(23, 0.0, -13),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.15, 0.15, 0.15)
    ));
    dynamicEntities.push(await loadCat(
        gpu, 
        new THREE.Vector3(-13, 0.0, 13),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.1, 0.1, 0.1)
    ));


    return { staticEntities, dynamicEntities, light, paths, cameraConfig: mainConfig };
}

async function loadCat(gpu: WebGPUData, position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3) {
    let cat = await loadAndAddObject('/assets/retep_niffirg.glb');
    if (cat) {
        cat.scale.set(scale.x, scale.y, scale.z);
        cat.position.set(position.x, position.y, position.z);
        cat.rotation.set(rotation.x, rotation.y, rotation.z);
        cat.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAT!');
    }
    const catMesh = await getModelBuffers(
        gpu,
        cat,
        modelType.DYNAMIC,
        position,
        rotation,
        scale
    );
    let approxedCat = getApproximatedGeometry(
        retepApprox,
        new THREE.Vector3(position.x - 0.1, position.y, position.z),
        new THREE.Euler(3 * Math.PI / 2 + rotation.x, 0.0 + rotation.y, Math.PI + rotation.z),
        scale
    );
    console.log(catApprox);
    updateApproxedGeometries();
    ApproxedGeometries.set(catMesh[0], approxedCat);
    return catMesh[0];
}

export async function sceneDoubleShadow(
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
    let cat = await loadCat(gpu,
        new THREE.Vector3(0, -0.5, 0),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.07, 0.07, 0.07));
    dynamicEntities.push(cat);

    // get wall 1
    const wall1 = createEntityFromGeometry(
        gpu,
        new THREE.BoxGeometry(50, 30, 1),
        modelType.STATIC,
        new THREE.Vector3(0, -1, 5),
        new THREE.Euler(0, undefined, undefined),
        1.0
    );
    staticEntities.push(wall1);
    const wall2 = createEntityFromGeometry(
        gpu,
        new THREE.BoxGeometry(50, 30, 1),
        modelType.STATIC,
        new THREE.Vector3(0, -1, -5),
        new THREE.Euler(0, undefined, undefined),
        1.0
    );
    staticEntities.push(wall2);

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

    const paths: Path[] = [];

    return { staticEntities, dynamicEntities, light, paths, cameraConfig: mainConfig };
}

export async function createStaticTestScene(
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

    let dynamicEntities: Entity[] = []
    const paths: Path[] = []

    return { staticEntities, dynamicEntities, light, paths, cameraConfig: mainConfig };
}
