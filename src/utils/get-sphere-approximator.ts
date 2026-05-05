import * as THREE from 'three/webgpu';
import { ComponentsMap, Entity } from '../scene/scene-types';

export type Sphere = {
    center: THREE.Vector3,
    radius: number
}

export type ApproxedGeometry = Sphere[];

interface SpherePrimitive {
    type: string;
    transform: {
        position: [number, number, number];
        scale: number;
    };
    bsdf: {
        type: string;
        ior?: number;
        albedo?: [number, number, number];
        [key: string]: any;
    };
}
interface ApproxJSON {
    primitives: SpherePrimitive[];
}

/*
    Get approximation from precomputed data in json format
*/
export function getApproximatedGeometry(src: ApproxJSON): ApproxedGeometry {
    let spheres: Sphere[] = [];

    for(const primitive of src.primitives) {
        if(primitive.type != "sphere") continue;
        spheres.push({ 
            radius: primitive.transform.scale, 
            center: new THREE.Vector3(
                primitive.transform.position[0],
                primitive.transform.position[1],
                primitive.transform.position[2],
            )});
    }

    return spheres;
}