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
import { getApproximatedGeometry } from '../utils/get-sphere-approximator';

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

export async function sceneWithOneSphere(
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
    let sphere = createEntityFromGeometry(
        gpu,
        new THREE.SphereGeometry(1.0),
        modelType.DYNAMIC,
        new THREE.Vector3(-1.0, 0.3, 5.0),
        new THREE.Euler(0.0, 0.0, 0.0),
        1.0
    );

    let approxedSphere = getApproximatedGeometry(
        sphereApprox,
        new THREE.Vector3(-1.0, 0.3, 5.0),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(1, 1, 1)
    );
    updateApproxedGeometries();

    ApproxedGeometries.set(sphere, approxedSphere);
    dynamicEntities.push(sphere);

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


async function debugOneScene(
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
        car.scale.setScalar(0.005);
        car.position.set(5, -0.5, 10);
        car.rotation.set(0.0, -Math.PI / 2, 0.0);
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
