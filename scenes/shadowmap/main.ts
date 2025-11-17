import * as THREE from 'three/webgpu'
import { addObject, getRenderer } from '../../src/renderer';
import { addCamera, setupControls } from '../../src/camera';

const scene = new THREE.Scene();

const camera = addCamera();

const renderer = getRenderer();

const obj = addObject();
scene.add(obj);

const controls = setupControls(camera, renderer);

function animate() {
    obj.rotation.x += 0.01;
    obj.rotation.y += 0.01;
    controls.update();
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
