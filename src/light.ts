import * as THREE from "three/webgpu";
import { webGPUData } from "./webgpu_data";

export interface lightSource {
    color: number | undefined;
    intensity: number | undefined;
    position: THREE.Vector3 | undefined;
    camera: THREE.Camera
};

export class pointLight implements lightSource {
    constructor(gpu: webGPUData) {      
        this.camera = new THREE.OrthographicCamera(
            -100, 100,
            100, -100,
            0.1, 70
        );
        this.direction = new THREE.Vector3(-3.0, 3.0, -3.0);
        this.position= new THREE.Vector3(10, 10, -10);
        this.camera.position.set(this.position.x, this.position.y, this.position.z);
        this.camera.lookAt(this.position.add(this.direction));
        this.camera.updateMatrixWorld(true);
    }
    camera: THREE.Camera;
    color: number | undefined;
    intensity: number | undefined;
    direction: THREE.Vector3;
    position: THREE.Vector3;
};

export function getVP(gpu: webGPUData, camera: THREE.Camera): Float32Array<ArrayBuffer> {
    camera.updateMatrixWorld(true);
    const lightViewMatrix = camera.matrixWorldInverse;
    const webgpuCorrection = new THREE.Matrix4().set(
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 0.5, 0,
        0, 0, 0.5, 1
    );
    const lightProjMatrix = camera.projectionMatrix.clone();
    
    const lightViewProjMatrix = new THREE.Matrix4()
        .multiplyMatrices(lightProjMatrix, lightViewMatrix);
    
    return new Float32Array(lightViewProjMatrix.elements);
}