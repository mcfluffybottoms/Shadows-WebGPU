import * as THREE from 'three/webgpu';
import { DirectionalLight } from './light-types';
import { ModelBuffers } from './buffer-types';
import { Path } from './movement/path';
import { CameraConfig } from '../utils/camera-utils';
import { ApproxedGeometry, getApproximatedGeometry } from '../utils/get-sphere-approximator';

// for render - transform and render per mesh
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
    offset: number
};

type Components = {
    RenderComponent: RenderComponent;
    ModelComponent: ModelComponent;
};

// ecs for storing rendering data
export const ComponentsMap: Map<Entity, Components[]> = new Map();
export const ApproxedGeometries: Map<Entity, ApproxedGeometry> = new Map();
export const PrecomputedGeometry: Map<Entity, GPUTexture> = new Map();
export const GeometryToPrecompute: Entity[] = [];

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

let numberOfStaticComponents = 0;
let numberOfDynamicComponents = 0;
let numberOfApproxedGeometries = 0;
export function updateApproxedGeometries() {
    numberOfApproxedGeometries++;
}
function updateComponentCount(type: modelType) {
    if(type == modelType.DYNAMIC) {
        numberOfDynamicComponents++;
    } else {
        numberOfStaticComponents++;
    }
}
export function getComponentCount(type: modelType) {
    if(type == modelType.DYNAMIC) {
        return numberOfDynamicComponents;
    } else {
        return numberOfStaticComponents;
    }
}
export function getApproxedGeometriesCount() {
    return numberOfApproxedGeometries;
}

let dynamicOffset = 0;
let staticOffset = 0;
function getOffset(type: modelType) {
    let offset = 0;
    if (type == modelType.DYNAMIC) {
        offset = dynamicOffset;
        dynamicOffset++;
    }
    if (type == modelType.STATIC) {
        offset = staticOffset;
        staticOffset++;
    }
    return offset;
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
    let offset = getOffset(type);
    updateComponentCount(type);
    ComponentsMap.set(entity, [{
        RenderComponent: { mesh, offset: offset },
        ModelComponent: { modelMatrix, type, position, rotation, scale },
    }]);
    return entity;
}

export function addEntityFromMultiple(
    meshes: ModelBuffers[],
    modelMatrices: THREE.Matrix4[],
    type: modelType,
    position: THREE.Vector3[],
    rotation: THREE.Euler[],
    scale: THREE.Vector3[]
): Entity {
    const entity = { id: generateID() };
    let components = [];
    for (let i = 0; i < meshes.length; i++) {
        updateComponentCount(type);
        let offset = getOffset(type);
        components.push({
            RenderComponent: { mesh: meshes[i], offset: offset },
            ModelComponent: { 
                modelMatrix: modelMatrices[i], 
                type, 
                position: 
                position[i], 
                rotation: 
                rotation[i], 
                scale: scale[i] 
            },
        });
    }
    ComponentsMap.set(entity, components);
    return entity;
}

