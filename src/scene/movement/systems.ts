import * as THREE from 'three/webgpu';
import { ApproxedGeometries, ComponentsMap, Entity, getModelMatrix, Scene } from '../scene-types';

export interface System {
    render(): void;
}

export enum EventType {
    MOVE,
}

export type Event = {
    type: EventType;
    entity: Entity;
    value: any;
};

export class DynamicSystem {
    constructor(scene: Scene) {
        this.scene = scene;
        this.last = performance.now();
    }

    // recalculate model matrix
    public update() {
        for (const path of this.scene.paths) {
            const e = path.entity;
            const components = ComponentsMap.get(e);
            const approxes = ApproxedGeometries.get(e);

            if (!components) {
                console.log(
                    'Model Component for Entity with id ' + e.id + ' not found.'
                );
                continue;
            }
            const event = path.move(1);
            for (const component of components) {
                const modelMatrix = component.ModelComponent;
                modelMatrix.position = new THREE.Vector3(
                    modelMatrix.position.x + event.value.delta.x,
                    modelMatrix.position.y,
                    modelMatrix.position.z + event.value.delta.y
                );
                modelMatrix.rotation = new THREE.Euler(
                    -Math.PI / 2,
                    modelMatrix.rotation.y,
                    modelMatrix.rotation.z,
                );
                modelMatrix.scale = modelMatrix.scale;
                modelMatrix.modelMatrix = getModelMatrix(
                    modelMatrix.position,
                    modelMatrix.rotation,
                    modelMatrix.scale
                );
            }
            if(approxes) {
                approxes.position = new THREE.Vector3(
                    approxes.position.x + event.value.delta.x,
                    approxes.position.y,
                    approxes.position.z  + event.value.delta.y
                );
                approxes.rotation = new THREE.Euler(
                    approxes.rotation.x,
                    approxes.rotation.y,
                    event.value.angle
                );
                approxes.scale = approxes.scale;
                approxes.modelMatrix = getModelMatrix(
                    approxes.position,
                    approxes.rotation,
                    approxes.scale
                );
            }
        }
    }

    private scene: Scene;
    private last: number;
}
