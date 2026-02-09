import * as THREE from "three/webgpu";
import {
  getModelBuffers,
  getModelBuffersFromMesh,
  getRenderer,
  loadAndAddObject,
} from "../../src/loader";
import { addCamera, CameraType, setupControlsCanvas } from "../../src/camera";
import { getWebGPU } from "../../src/webgpu_data";
import { depthPass, shadowPass } from "../../src/shadow";
import { pointLight } from "../../src/light";
import { renderDepthPass } from "../../src/shadowDebug";

// ---- get webgpu data ---- //
const gpu = await getWebGPU();

// ---- setup scene ---- //
let mainCamera = addCamera(gpu, CameraType.Perspective);

const renderer = getRenderer();
const obj = await loadAndAddObject("/itmo.obj");
if (obj) {
  obj.scale.setScalar(0.0001);
  obj.position.set(0, 0, 0);
  obj.updateMatrixWorld(true);
} else {
  throw new Error("NO OBJ!");
}
let entities = getModelBuffers(gpu, obj);
if(!entities) {
  throw new Error("NO meshes!");
}

export function createEntityFromGeometry(geom: THREE.BufferGeometry, pos: {x: number, y: number, z: number}) {
  const mesh = new THREE.Mesh(geom);
  mesh.position.set(pos.x, pos.y, pos.z);
  mesh.updateMatrixWorld();
  const entity = { 
    mesh: getModelBuffersFromMesh(gpu, mesh), 
    modelMatrix: mesh.matrixWorld
  };
  return entity;
}

const plane = createEntityFromGeometry(new THREE.PlaneGeometry(50, 45), {x: 50, y: 25, z: 25});
plane.modelMatrix.makeRotationX(-Math.PI /2 );
entities.push(plane);

const cube = createEntityFromGeometry(new THREE.BoxGeometry(6, 6, 6), {x: 5, y: 3.1, z: -5});
entities.push(cube);

const sphere = createEntityFromGeometry(new THREE.SphereGeometry(4), {x: 8, y: 4.1, z: 10});
entities.push(sphere);
// light visual 

const cone = createEntityFromGeometry(new THREE.ConeGeometry(4, 10), {x: 0, y: 5.1, z: 10});
entities.push(cone);

// ---- DEPTH MAP ---- //

// create shadowmap
const shadowMap = { shadowDepthTextureSize: 1024 };
const light = new pointLight(gpu);
let controls = setupControlsCanvas(mainCamera, gpu.canvas);


// const lightVis = createEntityFromGeometry(new THREE.BoxGeometry(1, 1, 1), light.camera.position);
// entities.push(lightVis);

document.getElementById('changePos')?.addEventListener('change', () => { 
  const cameraSelect = document.getElementById('changePos') as HTMLSelectElement;
  if (controls && controls.dispose) {
    controls.dispose();
  }
  if(cameraSelect.value == "1") {
    console.log("cameraSelect.value == 0");
    controls = setupControlsCanvas(light.camera, gpu.canvas);
  } else {
    console.log("cameraSelect.value == 1");
    controls = setupControlsCanvas(mainCamera, gpu.canvas);
  }
});

enum renderWhat {
  depth,
  shadow
}
let render = renderWhat.shadow;
document.getElementById('render')?.addEventListener('change', () => { 
  const cameraSelect = document.getElementById('render') as HTMLSelectElement;
  if(cameraSelect.value == "0") {
    render = renderWhat.shadow;
  } else {
    render = renderWhat.depth;
  }
});

// // MAIN LOOP
async function animate() {
  controls.update();
  //entities[entities.length - 1].modelMatrix.setPosition(light.camera.position);
  const encoder = gpu.device.createCommandEncoder();
  const depthMapData = await depthPass(shadowMap, gpu, entities, encoder, light);
  if(render == renderWhat.depth) {
    await renderDepthPass(shadowMap, gpu, entities, depthMapData, encoder, light);
  } else {
    await shadowPass(shadowMap, gpu, entities, depthMapData, encoder, light, mainCamera);
  }
  gpu.device.queue.submit([encoder.finish()]);

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);