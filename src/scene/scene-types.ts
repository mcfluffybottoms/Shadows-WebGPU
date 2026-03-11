import * as THREE from "three/webgpu";
import { DirectionalLight, LightSource } from "./light-types";

export interface ModelBuffers {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer | null;
  color?: GPUBuffer;

  vertexCount: number;
  indexCount: number;
};

export type Entity = {
  mesh: ModelBuffers;
  modelMatrix: THREE.Matrix4
};

export type Scene = {
  entities: Entity[];
  light: DirectionalLight;
};