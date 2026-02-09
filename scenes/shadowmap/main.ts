import * as THREE from "three/webgpu";
import {
  getModelBuffers,
  getModelBuffersFromMesh,
  getRenderer,
  loadAndAddObject,
} from "../../src/loader";
import { addCamera, CameraType, setupControlsCanvas } from "../../src/camera";
import { getWebGPU } from "../../src/webgpu_data";
import { pointLight } from "../../src/light";
import { initRenderDepthPass, renderDepthPass } from "../../src/shadowDebug";
import { depthPass, getDepthMap, initDepthPass } from "../../src/depthPass";
import { initShadowPass, shadowPass } from "../../src/shadowPass";

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

// init renderpass data 
//// gpu: webGPUData, entities: Entity[]
const depthMap = getDepthMap(gpu, 1024);
const depthPassResources = await initDepthPass(gpu, entities);
const shadowPassResources = await initShadowPass(gpu, entities, depthMap);
const renderDepthPassResources = await initRenderDepthPass(gpu, depthMap);

// // MAIN LOOP
async function animate() {
  controls.update();
  const encoder = gpu.device.createCommandEncoder();
  await depthPass(depthMap, depthPassResources, gpu, entities, encoder, light);
  if(render == renderWhat.depth) {
    await renderDepthPass(renderDepthPassResources, gpu, depthMap, encoder, light);
  } else {
    await shadowPass(shadowPassResources, gpu, encoder, depthMap, entities, light, mainCamera);
  }
  gpu.device.queue.submit([encoder.finish()]);

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);