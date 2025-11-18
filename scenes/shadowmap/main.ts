import * as THREE from 'three/webgpu'
import { getRenderer, loadAndAddObject, loadMeshFromLink } from '../../src/renderer';
import { addCamera, setupControls } from '../../src/camera';

const scene = new THREE.Scene();

const camera = addCamera();
camera.position.set(21.6, 4.3, -18);
camera.rotation.set(-2.6, 0.4, 2.9);

const renderer = getRenderer();

const obj = await loadAndAddObject("/itmo.obj", scene);
if (obj) {
    obj.scale.setScalar(0.0001);
    scene.add(obj);
} else {
    console.error("not loaded");
}

const controls = setupControls(camera, renderer);

function animate() {
    controls.update();
    console.log(camera.position);
    console.log(camera.rotation);
    renderer.render(scene, camera);

}

renderer.setAnimationLoop(animate);
