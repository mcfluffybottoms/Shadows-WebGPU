import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three/webgpu'
import { webGPUData } from './webgpu_data';

export function addPerspectiveCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.set(17.733736277643853, 1.8645731021897773, -11.723682572752207);
    camera.rotation.set(-2.907098534188704, 0.862378271482270, 2.9621339797774384);
    return camera
}

export function setupControls(camera: THREE.Camera, renderer: THREE.WebGPURenderer): OrbitControls {
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;

    controls.enableDamping = true;
    controls.dampingFactor = 0.05
    controls.zoomSpeed = 100.0;
    controls.update();
    return controls
}

export function setupControlsCanvas(camera: THREE.Camera, canvas: HTMLCanvasElement): OrbitControls {
    const controls = new OrbitControls(camera, canvas);
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };
    controls.target.set(0, 0, 0);
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.update();
    return controls
}

export enum CameraType {
    Orthographic,
    Perspective
}

export function addCamera(gpu: webGPUData, type: CameraType): THREE.Camera {
    var camera;
    const aspect = gpu.canvas.width / gpu.canvas.height;
    if (type == CameraType.Orthographic) {
        camera = new THREE.OrthographicCamera(
            -gpu.canvas.width / 2, 
            gpu.canvas.width / 2, 
            gpu.canvas.height / 2, 
            -gpu.canvas.height / 2, 
            0.1, 
            1000);
    } else {
        camera = new THREE.PerspectiveCamera(
            70,
            aspect,
            0.1,
            100
        );
    }
    camera.position.set(17.733736277643853, 1.8645731021897773, -11.723682572752207);
    camera.rotation.set(-2.907098534188704, 0.862378271482270, 2.9621339797774384);
    return camera
}