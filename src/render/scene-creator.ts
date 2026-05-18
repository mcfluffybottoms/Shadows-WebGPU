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

// ----- DEBUG - MAKE A TEST SCENE ----- //
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

    // add car
    let car = await loadAndAddObject('/assets/low_poly_car.glb');
    if (car) {
        car.scale.setScalar(0.005);
        car.position.set(5, 0.0, 14);
        car.rotation.set(0.0, -Math.PI / 2, 0.0);
        car.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }
    const carMesh1 = await getModelBuffers(
        gpu,
        car,
        modelType.DYNAMIC,
        new THREE.Vector3(5, 0.0, 14),
        new THREE.Euler(0.0, -Math.PI / 2, 0.0),
        new THREE.Vector3(0.005, 0.005, 0.005)
    );
    const approxedCar1 = getApproximatedGeometry(
        carApprox,
        new THREE.Vector3(5, 0.0, 14),
        new THREE.Euler(0.0, -Math.PI / 2, 0.0),
        new THREE.Vector3(0.005, 0.005, 0.005)
    );
    updateApproxedGeometries();
    ApproxedGeometries.set(carMesh1[0], approxedCar1);
    dynamicEntities.push(carMesh1[0]);

    let car2 = await loadAndAddObject('/assets/low_poly_car.glb');
    if (car2) {
        car2.scale.setScalar(0.01);
        car2.position.set(20, 0.0, 4);
        car2.rotation.set(0.0, -Math.PI / 6, 0.0);
        car2.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }
    const carMesh2 = await getModelBuffers(
        gpu,
        car2,
        modelType.DYNAMIC,
        new THREE.Vector3(20, 0.0, 4),
        new THREE.Euler(0.0, -Math.PI / 6, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    const approxedCar2 = getApproximatedGeometry(
        carApprox,
        new THREE.Vector3(20, 0.0, 4),
        new THREE.Euler(0.0, -Math.PI / 6, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    updateApproxedGeometries();
    ApproxedGeometries.set(carMesh2[0], approxedCar2);
    dynamicEntities.push(carMesh2[0]);

    let car3 = await loadAndAddObject('/assets/low_poly_car.glb');
    if (car3) {
        car3.scale.setScalar(0.01);
        car3.position.set(23, 0.0, 13);
        car3.rotation.set(0.0, 0.0, 0.0);
        car3.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }
    const carMesh3 = await getModelBuffers(
        gpu,
        car3,
        modelType.DYNAMIC,
        new THREE.Vector3(23, 0.0, 13),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    const approxedCar3 = getApproximatedGeometry(
        carApprox,
        new THREE.Vector3(23, 0.0, 13),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    updateApproxedGeometries();
    ApproxedGeometries.set(carMesh3[0], approxedCar3);
    dynamicEntities.push(carMesh3[0]);


    let car4 = await loadAndAddObject('/assets/low_poly_car.glb');
    if (car4) {
        car4.scale.setScalar(0.01);
        car4.position.set(21, 0.0, 23);
        car4.rotation.set(0.0, Math.PI / 2, 0.0);
        car4.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }
    const carMesh4 = await getModelBuffers(
        gpu,
        car4,
        modelType.DYNAMIC,
        new THREE.Vector3(21, 0.0, 23),
        new THREE.Euler(0.0, Math.PI / 2, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    const approxedCar4 = getApproximatedGeometry(
        carApprox,
        new THREE.Vector3(21, 0.0, 23),
        new THREE.Euler(0.0, Math.PI / 2, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    updateApproxedGeometries();
    ApproxedGeometries.set(carMesh4[0], approxedCar4);
    dynamicEntities.push(carMesh4[0]);


    console.log(ApproxedGeometries)
    return { staticEntities, dynamicEntities, light, paths, cameraConfig: mainConfig };
}

export async function createTestScene(
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

export async function createDynamicTestScene(
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

export async function debugSpheresTestScene(
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

    const paths: Path[] = [];

    return { staticEntities, dynamicEntities, light, paths, cameraConfig: mainConfig };
}

async function loadCar(gpu: WebGPUData, position: THREE.Vector3) {
    let car = await loadAndAddObject('/assets/low_poly_car.glb');
    if (car) {
        car.scale.setScalar(0.0051);
        car.position.set(position.x, position.y, position.z);
        car.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }
    const carMesh = await getModelBuffers(
        gpu,
        car,
        modelType.DYNAMIC,
        position,
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.0051, 0.0051, 0.0051)
    );
    let approxedCar = getApproximatedGeometry(
        carApprox,
        position,
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.005, 0.005, 0.005)
    );
    

    updateApproxedGeometries();
    ApproxedGeometries.set(carMesh[0], approxedCar);
    return carMesh[0];
}

export async function manyCars(
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
    const gridSize = 5; 
    const spacing = 5;
    for(let i = 0; i < 20; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        
        const x = (col - 2) * spacing;
        const z = (row - 1.5) * spacing;
        const position = new THREE.Vector3(x, -0.5, z);
        dynamicEntities.push(await loadCar(gpu, position)); 
    }

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
    let approxedRetep = getApproximatedGeometry(
        retepApprox,
        new THREE.Vector3(-1.0, 1.0, 0.0),
        new THREE.Euler(3 * Math.PI / 2, 0.0, Math.PI),
        new THREE.Vector3(1.0, 1.0, 1.0)
    );

    let retep = await loadAndAddObject('/assets/retep_niffirg.glb');
    if (retep) {
        retep.scale.setScalar(1.0);
        retep.position.set(0.0, 0.0, 0.0);
        retep.rotation.set(0.0, Math.PI, 0.0);
        retep.updateMatrixWorld(true);
    } else {
        throw new Error('NO RETEP!');
    }
    const retepMesh = await getModelBuffers(
        gpu,
        retep,
        modelType.DYNAMIC,
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Euler(0.0, Math.PI, 0.0),
        new THREE.Vector3(0.005, 0.005, 0.005)
    );
    updateApproxedGeometries();
    ApproxedGeometries.set(retepMesh[0], approxedRetep);
    dynamicEntities.push(retepMesh[0]);
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

export async function sceneWithRetep(
    gpu: WebGPUData,
    mainConfig: CameraConfig,
    direction: THREE.Vector3
): Promise<Scene> {
    // light source
    const light = new DirectionalLight();
    light.direction = direction;

    // add object entities
    let staticEntities: Entity[] = [];
    let dynamicEntities: Entity[] = [];

    // get first car
    let approxedSpheres = getApproximatedGeometry(
        retepApprox,
        new THREE.Vector3(0.0, 0.0, 0.0),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(1.0, 1.0, 1.0)
    );


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

export async function debugTwoApproxedCars(
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
        car.rotation.set(0.0, 0.0, 0.0);
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

export async function threeApproxedCars(
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
        car.position.set(-8, -0.5, 0);
        car.rotation.set(0.0, 0.0, 0.0);
        car.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }
    const carMesh = await getModelBuffers(
        gpu,
        car,
        modelType.DYNAMIC,
        new THREE.Vector3(-8, -0.5, 0),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    let approxedCar = getApproximatedGeometry(
        carApprox,
        new THREE.Vector3(-8, -0.5, 0),
        new THREE.Euler(0.0, 0.0, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    updateApproxedGeometries();
    ApproxedGeometries.set(carMesh[0], approxedCar);
    dynamicEntities.push(carMesh[0]);

    // get second car
    car = await loadAndAddObject('/assets/low_poly_car.glb');
    if (car) {
        car.scale.setScalar(0.01);
        car.position.set(8, -0.5, 0);
        car.rotation.set(0.0, Math.PI / 4, 0.0);
        car.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }
    const carMesh1 = await getModelBuffers(
        gpu,
        car,
        modelType.DYNAMIC,
        new THREE.Vector3(8, -0.5, 0),
        new THREE.Euler(0.0, Math.PI / 4, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    const approxedCar1 = getApproximatedGeometry(
        carApprox,
        new THREE.Vector3(8, -0.5, 0),
        new THREE.Euler(0.0, Math.PI / 4, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    approxedCar1.model = approxedCar.model;
    updateApproxedGeometries();
    ApproxedGeometries.set(carMesh1[0], approxedCar1);
    dynamicEntities.push(carMesh1[0]);

    // get third car
    car = await loadAndAddObject('/assets/low_poly_car.glb');
    if (car) {
        car.scale.setScalar(0.01);
        car.position.set(0, -0.5, 0);
        car.rotation.set(0.0, -Math.PI / 2, 0.0);
        car.updateMatrixWorld(true);
    } else {
        throw new Error('NO CAR!');
    }
    const carMesh2 = await getModelBuffers(
        gpu,
        car,
        modelType.DYNAMIC,
        new THREE.Vector3(0, -0.5, 0),
        new THREE.Euler(0.0, -Math.PI / 2, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    const approxedCar2 = getApproximatedGeometry(
        carApprox,
        new THREE.Vector3(0, -0.5, 0),
        new THREE.Euler(0.0, -Math.PI / 2, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    updateApproxedGeometries();
    ApproxedGeometries.set(carMesh2[0], approxedCar2);
    dynamicEntities.push(carMesh2[0]);

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
    let car = await loadAndAddObject('/assets/low_poly_car.glb');
    if (car) {
        car.scale.setScalar(0.01);
        car.position.set(0, -0.5, 0);
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
        new THREE.Euler(0.0, -Math.PI / 2, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    let approxedCar = getApproximatedGeometry(
        carApprox,
        new THREE.Vector3(0, -0.5, 0),
        new THREE.Euler(0.0, -Math.PI / 2, 0.0),
        new THREE.Vector3(0.01, 0.01, 0.01)
    );
    updateApproxedGeometries();
    ApproxedGeometries.set(carMesh[0], approxedCar);
    dynamicEntities.push(carMesh[0]);

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

    const paths: Path[] = [
        // new Path(carMesh[0], Circle(), 0, new THREE.Vector3(0, 0, 0), 0, 0.05),
        // new Path(carMesh1[0], Circle(), 2, new THREE.Vector3(0, 0, 0), 0, 0.05),
    ];

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
