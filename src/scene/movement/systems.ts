import * as THREE from "three/webgpu";
import { ComponentsMap, Entity, getModelMatrix, Scene } from "../scene-types";


export interface System {
  render(): void;
};


export enum EventType {
  MOVE
}

export type Event = {
  type: EventType,
  entity: Entity,
  value: any
}

export class DynamicSystem {
  constructor(scene: Scene) {
    this.scene = scene;
    this.last =  performance.now();
  }

  // recalculate model matrix
  public update() {
    for(const path of this.scene.paths) {
      const e = path.entity;
      const component = ComponentsMap.get(e)?.ModelComponent;
      if(!component) {
        console.log("Model Component for Entity with id " + e.id + " not found.");
        continue;
      }
      const event = path.move(1, 0.2);
      component.position = new THREE.Vector3(event.value.point.x, 0, event.value.point.y);
      component.rotation.z = event.value.angle;
      component.scale = new THREE.Vector3(0.05, 0.05, 0.05);
      component.modelMatrix = getModelMatrix(component);

      
    }
  }

  private scene: Scene;
  private last: number;
};