import * as THREE from 'three/webgpu';
import { DirectionalLight } from './light-types';
import { ModelBuffers } from './buffer-types';
import { Path } from './movement/path';
import { CameraConfig } from '../utils/camera-utils';
import { ApproxedGeometry, getApproximatedGeometry } from '../utils/get-sphere-approximator';

export type Entity = {
    id: number;
};

export enum modelType {
    STATIC,
    DYNAMIC,
}

export type ModelComponent = {
    modelMatrix: THREE.Matrix4;
    type: modelType;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
};

// export function getModelMatrix(m: ModelComponent) {
//     if (!m.position || !m.rotation || !m.scale) {
//         return m.modelMatrix;
//     }

//     const matrix = new THREE.Matrix4();
//     matrix.compose(
//         m.position,
//         new THREE.Quaternion().setFromEuler(
//             new THREE.Euler(m.rotation.x, m.rotation.y, m.rotation.z, 'XYZ')
//         ),
//         m.scale
//     );
//     return matrix;
// }

export function getModelMatrix(
    position: THREE.Vector3,
    rotation: THREE.Euler,
    scale: THREE.Vector3
) {
    const matrix = new THREE.Matrix4();
    matrix.compose(
        position,
        new THREE.Quaternion().setFromEuler(rotation),
        scale
    );
    return matrix;
}

export type RenderComponent = {
    mesh: ModelBuffers;
};

type Components = {
    RenderComponent: RenderComponent;
    ModelComponent: ModelComponent;
};

// ecs for storing rendering data
export const ComponentsMap: Map<Entity, Components> = new Map();
export const ApproxedGeometries: Map<Entity, ApproxedGeometry> = new Map();

// TODO - add camera
export type Scene = {
    paths: Path[];
    cameraConfig: CameraConfig;
    light: DirectionalLight;
    staticEntities: Entity[];
    dynamicEntities: Entity[];
};

// id generator
var id = -1;
function generateID() {
    ++id;
    return id;
}

export function addEntity(
    mesh: ModelBuffers,
    modelMatrix: THREE.Matrix4,
    type: modelType,
    position: THREE.Vector3,
    rotation: THREE.Euler,
    scale: THREE.Vector3
): Entity {
    const entity = { id: generateID() };
    ComponentsMap.set(entity, {
        RenderComponent: { mesh },
        ModelComponent: { modelMatrix, type, position, rotation, scale },
    });
    ComponentsMap.set(entity, {
        RenderComponent: { mesh },
        ModelComponent: { modelMatrix, type, position, rotation, scale },
    });
    return entity;
}
