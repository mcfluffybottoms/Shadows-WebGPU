import * as THREE from "three/webgpu";
import { DirectionalLight, LightSource } from "./light-types";
import { ModelBuffers } from "./buffer-types";
import { Path } from "./movement/path";

export type Entity = {
  id: number;
};

export type ModelComponent = {
  modelMatrix: THREE.Matrix4;
  position?: THREE.Vector3;
  rotation?: THREE.Vector3;
  scale?: THREE.Vector3;
};

export function getModelMatrix(m: ModelComponent) {
  if(!m.position || !m.rotation || !m.scale) {
    return m.modelMatrix;
  }

  const matrix = new THREE.Matrix4();
  matrix.compose(m.position, new THREE.Quaternion().setFromEuler(new THREE.Euler(
    m.rotation.x,
    m.rotation.y,
    m.rotation.z,
    'XYZ'
  )), m.scale);
  return matrix;
}

export type RenderComponent = {
  mesh: ModelBuffers;
};

type Components = {
  RenderComponent: RenderComponent, 
  ModelComponent: ModelComponent
};

// maybe a better approach, but this may allow coalesed load
export const ComponentsMap: Map<Entity, Components> = new Map();

// TODO - add camera
export type Scene = {
  entities: Entity[];
  paths: Path[];
  light: DirectionalLight;
};

// id generator
var id = -1;
function generateID() {
  ++id;
  return id;
}

export function addEntity(mesh: ModelBuffers, modelMatrix: THREE.Matrix4, position?: THREE.Vector3, rotation?: THREE.Vector3, scale?: THREE.Vector3) : Entity {
  const entity = {id: generateID()};
  ComponentsMap.set(entity, {
    RenderComponent: { mesh },
    ModelComponent: { modelMatrix, position, rotation, scale }
  });
  return entity;
}