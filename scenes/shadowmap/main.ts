import * as THREE from 'three/webgpu'
import { addObject, getRenderer } from '../../src/renderer';
import { addCamera, makeDraggable, moveCamera } from '../../src/camera';

const scene = new THREE.Scene();
const camera = addCamera();

makeDraggable(camera);

const renderer = getRenderer();
const obj = addObject();
scene.add(obj);

camera.position.z = 5;

function animate() {
    obj.rotation.x += 0.01;
    obj.rotation.y += 0.01;
    console.log(camera.position);
    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);