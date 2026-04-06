import { Entity } from "../scene-types";
import { EventType } from "./systems";
import * as THREE from "three/webgpu";

type Point = {
    x: number,
    y: number
};


// loader
export function parsePathFile(fileLocation: string) : Point[] {
    return [
        {x: 10.000, y: 0.000},
        {x: 9.980, y: 0.628},
        {x: 9.921, y: 1.253},
        {x: 9.823, y: 1.874},
        {x: 9.686, y: 2.487},
        {x: 9.511, y: 3.090},
        {x: 9.298, y: 3.681},
        {x: 9.048, y: 4.258},
        {x: 8.763, y: 4.818},
        {x: 8.443, y: 5.358},
        {x: 8.090, y: 5.878},
        {x: 7.705, y: 6.374},
        {x: 7.290, y: 6.845},
        {x: 6.845, y: 7.290},
        {x: 6.374, y: 7.705},
        {x: 5.878, y: 8.090},
        {x: 5.358, y: 8.443},
        {x: 4.818, y: 8.763},
        {x: 4.258, y: 9.048},
        {x: 3.681, y: 9.298},
        {x: 3.090, y: 9.511},
        {x: 2.487, y: 9.686},
        {x: 1.874, y: 9.823},
        {x: 1.253, y: 9.921},
        {x: 0.628, y: 9.980},
        {x: 0.000, y: 10.000},
        {x: -0.628, y: 9.980},
        {x: -1.253, y: 9.921},
        {x: -1.874, y: 9.823},
        {x: -2.487, y: 9.686},
        {x: -3.090, y: 9.511},
        {x: -3.681, y: 9.298},
        {x: -4.258, y: 9.048},
        {x: -4.818, y: 8.763},
        {x: -5.358, y: 8.443},
        {x: -5.878, y: 8.090},
        {x: -6.374, y: 7.705},
        {x: -6.845, y: 7.290},
        {x: -7.290, y: 6.845},
        {x: -7.705, y: 6.374},
        {x: -8.090, y: 5.878},
        {x: -8.443, y: 5.358},
        {x: -8.763, y: 4.818},
        {x: -9.048, y: 4.258},
        {x: -9.298, y: 3.681},
        {x: -9.511, y: 3.090},
        {x: -9.686, y: 2.487},
        {x: -9.823, y: 1.874},
        {x: -9.921, y: 1.253},
        {x: -9.980, y: 0.628},
        {x: -10.000, y: 0.000},
        {x: -9.980, y: -0.628},
        {x: -9.921, y: -1.253},
        {x: -9.823, y: -1.874},
        {x: -9.686, y: -2.487},
        {x: -9.511, y: -3.090},
        {x: -9.298, y: -3.681},
        {x: -9.048, y: -4.258},
        {x: -8.763, y: -4.818},
        {x: -8.443, y: -5.358},
        {x: -8.090, y: -5.878},
        {x: -7.705, y: -6.374},
        {x: -7.290, y: -6.845},
        {x: -6.845, y: -7.290},
        {x: -6.374, y: -7.705},
        {x: -5.878, y: -8.090},
        {x: -5.358, y: -8.443},
        {x: -4.818, y: -8.763},
        {x: -4.258, y: -9.048},
        {x: -3.681, y: -9.298},
        {x: -3.090, y: -9.511},
        {x: -2.487, y: -9.686},
        {x: -1.874, y: -9.823},
        {x: -1.253, y: -9.921},
        {x: -0.628, y: -9.980},
        {x: -0.000, y: -10.000},
        {x: 0.628, y: -9.980},
        {x: 1.253, y: -9.921},
        {x: 1.874, y: -9.823},
        {x: 2.487, y: -9.686},
        {x: 3.090, y: -9.511},
        {x: 3.681, y: -9.298},
        {x: 4.258, y: -9.048},
        {x: 4.818, y: -8.763},
        {x: 5.358, y: -8.443},
        {x: 5.878, y: -8.090},
        {x: 6.374, y: -7.705},
        {x: 6.845, y: -7.290},
        {x: 7.290, y: -6.845},
        {x: 7.705, y: -6.374},
        {x: 8.090, y: -5.878},
        {x: 8.443, y: -5.358},
        {x: 8.763, y: -4.818},
        {x: 9.048, y: -4.258},
        {x: 9.298, y: -3.681},
        {x: 9.511, y: -3.090},
        {x: 9.686, y: -2.487},
        {x: 9.823, y: -1.874},
        {x: 9.921, y: -1.253},
        {x: 9.980, y: -0.628},
    ];
}

export class Path {
    constructor(entity: Entity, path: Point[], currentPosition: Point, currentRotation: number) {
        this.path = path;
        this.pointID = 0;
        this.entity = entity;
        this.currentPosition = currentPosition;
        this.currentRotation = currentRotation;
    }

    public move(deltaTime: number = 1, speed: number = 100) {
       
        const targetPoint = this.path[this.pointID];
        const distanceToTarget = Math.hypot(
            targetPoint.x - this.currentPosition.x,
            targetPoint.y - this.currentPosition.y
        );
        
        const stepDistance = Math.min(distanceToTarget, speed * deltaTime);
        const t = distanceToTarget === 0 ? 0 : stepDistance / distanceToTarget;
        
        this.currentPosition = Path.lerp(this.currentPosition, targetPoint, t);
        if (stepDistance >= distanceToTarget) {
            this.pointID = (this.pointID + 1) % this.path.length;
        }

        return {
            type: EventType.MOVE,
            entity: this.entity,
            value: {
                angle: this.rotate(t),
                point: this.currentPosition
            },
        };
    }

    private rotate(t: number) {
        const targetPoint = this.path[this.pointID];
        const dir = new THREE.Vector3(targetPoint.x - this.currentPosition.x, 0, targetPoint.y - this.currentPosition.y).normalize();
        let rotz = Math.atan2(dir.x, dir.z);
        this.currentRotation = Path.lerpNumber(this.currentRotation, rotz, t);
        return this.currentRotation;
    }

    static lerp(p1: Point, p2: Point, t: number): Point {
        return {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t
        };
    }

    static lerpNumber(p1: number, p2: number, t: number): number {
        return p1 + (p2 - p1) * t;
    }

    path: Point[];
    currentPosition: Point;
    currentRotation: number;
    pointID: number;
    entity: Entity;
}
