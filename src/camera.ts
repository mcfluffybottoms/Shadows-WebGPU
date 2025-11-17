import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three/webgpu'

export function addCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.set(0, 2, 5);
    return camera
}

export function setupControls(camera : THREE.PerspectiveCamera, renderer : THREE.WebGPURenderer): OrbitControls {
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.update();
    return controls
}