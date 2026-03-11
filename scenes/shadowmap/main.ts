import * as THREE from "three/webgpu";
import {
  createEntityFromGeometry,
  getModelBuffers,
  loadAndAddObject,
} from "../../src/utils/loader";
import { getWebGPU } from "../../src/utils/webgpu-data";
import { DirectionalLight } from "../../src/scene/light-types";
import { initRenderDepthPass, renderDepthPass } from "../../src/passes/depthMapDebug";
import { depthPass, getDepthMap, initDepthPass } from "../../src/passes/depthPass";
import { initShadowPass, shadowPass } from "../../src/passes/shadowPass";
import { createSceneBuffers, fillSceneBuffers } from "../../src/scene/scene-buffers";
import { addCamera, CameraType } from "../../src/utils/camera-utils";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { cameraWhat, changeConfig, controllingWhat, renderWhat, UI, UIchanged } from "./UIcontroller";
import { changeFPS, changeMPF, initUInteractions } from "./UI";
import { Scene } from "../../src/scene/scene-types";
import { createConfigBuffers } from "../../src/config/config-buffers";

// ---- get webgpu data ---- //
const gpu = await getWebGPU();

// camera
export type cameraConfig = {
  camera: THREE.Camera;
  controls: OrbitControls
}
function setControls(camera: THREE.Camera) {
  const controls = new OrbitControls(camera, gpu.canvas);
  controls.target.set(0, 0, 0);
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.update();
  return controls;
}
let orthoCamera = addCamera(gpu.canvas, CameraType.Orthographic);
let orthoControls = setControls(orthoCamera);
let perspectiveCamera = addCamera(gpu.canvas, CameraType.Perspective);
let perspectiveControls = setControls(perspectiveCamera);

let mainCamera = perspectiveCamera;
let mainControls = perspectiveControls;

// light source
const light = new DirectionalLight(mainCamera, UI.numOfCascades);

// ------ SETUP UI ------ //

initUInteractions();

function updateCamera(scene: Scene) {
  if (UIchanged.cameraWhat) {
    mainControls.disconnect();
    if (UI.cameraWhat == cameraWhat.Orthographic) {
      mainCamera = orthoCamera;
      mainControls = orthoControls;
    } else {
      mainCamera = perspectiveCamera;
      mainControls = perspectiveControls;
    }
    mainControls.connect(gpu.canvas);

    scene.camera = mainCamera;
    UIchanged.cameraWhat = false;
  }
}

// ------ INIT SCENE ------ //
// ---- setup objects to display on scene ---- //
const obj = await loadAndAddObject("/assets/with_mechet.glb");
if (obj) {
  obj.scale.setScalar(0.1);
  obj.position.set(0, 0, 0);
  obj.updateMatrixWorld(true);
} else {
  throw new Error("NO OBJ!");
}

let entities = getModelBuffers(gpu, obj);
if (!entities) {
  console.warn("Models were not loaded.");
  entities = [];
}

const plane = createEntityFromGeometry(gpu, new THREE.BoxGeometry(50, 45, 1), { x: 50, y: 25, z: 25 });
plane.modelMatrix.makeRotationX(-Math.PI / 2);
entities.push(plane);

// const cube = createEntityFromGeometry(gpu, new THREE.BoxGeometry(6, 6, 6), { x: 5, y: 3.1, z: -5 });
// entities.push(cube);

// const sphere = createEntityFromGeometry(gpu, new THREE.SphereGeometry(4), { x: 8, y: 4.1, z: 10 });
// entities.push(sphere);

// const cone = createEntityFromGeometry(gpu, new THREE.ConeGeometry(4, 10), { x: 0, y: 5.1, z: 10 });
// entities.push(cone);

// const dodecahedron = createEntityFromGeometry(gpu, new THREE.DodecahedronGeometry(3, 2), { x: -10, y: 4, z: -10 });
// entities.push(dodecahedron);

const scene = {
  entities, light, camera: mainCamera
};
const buffers = createSceneBuffers(gpu, scene);

// ------ INIT SCENE ------ //

// ------ init renderpass data ------ //
// config
const configBuffer = createConfigBuffers(gpu);

var depthMap = getDepthMap(gpu, UI.depthPassSize, UI.numOfCascades);
var depthPassResources = await initDepthPass(gpu, scene, buffers.lightBuffer, buffers.objectBuffer, configBuffer, UI.numOfCascades);
var shadowPassResources = await initShadowPass(gpu, scene, depthMap, buffers, configBuffer, UI.numOfCascades);
var renderDepthPassResources = await initRenderDepthPass(gpu, depthMap, UI.depthMapCascade);

async function renderColor(encoder: GPUCommandEncoder) {
  if (UI.renderWhat == renderWhat.depthMap) {
    await renderDepthPass(renderDepthPassResources, gpu, encoder);
  } else {
    await shadowPass(shadowPassResources, gpu, encoder, scene, UI.numOfCascades);
  }
}

async function updateSettings() {
  if (UIchanged.depthPassSizeChanged || UIchanged.configChanged) {
    depthMap = getDepthMap(gpu, UI.depthPassSize, UI.numOfCascades);
    depthPassResources = await initDepthPass(gpu, scene, buffers.lightBuffer, buffers.objectBuffer, configBuffer, UI.numOfCascades);
    shadowPassResources = await initShadowPass(gpu, scene, depthMap, buffers, configBuffer, UI.numOfCascades);
    renderDepthPassResources = await initRenderDepthPass(gpu, depthMap, UI.depthMapCascade);
    UIchanged.depthPassSizeChanged = false;
  }
  changeConfig(gpu, configBuffer);
  updateCamera(scene);
}

function changeDirection(light: DirectionalLight) : boolean {
    light.direction = UI.direction;
    UIchanged.directionChanged = false;
    return true;
}

// ------ MAIN LOOP ------ //
let lastTime = performance.now();
let frameCount = 0;
let fps = 0;
let mpf = 0;
let mpfHistory: number[] = [];
async function animate() {
  await updateSettings();
  if(UIchanged.directionChanged) changeDirection(light);
  light.update(mainCamera, UI.numOfCascades, UI.depthPassSize);
  

  const frameStart = performance.now();

  const encoder = gpu.device.createCommandEncoder();
  fillSceneBuffers(gpu, buffers, scene, UI.numOfCascades);

  await depthPass(depthMap, depthPassResources, gpu, encoder, scene, UI.numOfCascades);
  await renderColor(encoder);
  gpu.device.queue.submit([encoder.finish()]);

  const frameEnd = performance.now();

  // ------ PROFILING ------ //
  mpf = frameEnd - frameStart;
  mpfHistory.push(mpf);
  if (mpfHistory.length > 60) mpfHistory.shift();

  frameCount++;
  const currentTime = performance.now();
  const elapsed = currentTime - lastTime;
  if (elapsed >= 1000) {
    // FPS
    fps = Math.round((frameCount * 1000) / elapsed);
    frameCount = 0;
    lastTime = currentTime;
    changeFPS(fps);
    // MPF
    const avgMpf = mpfHistory.reduce((sum, val) => sum + val, 0) / mpfHistory.length;
    const maxMpf = Math.max(...mpfHistory);
    const minMpf = Math.min(...mpfHistory);
    mpfHistory = [];
    changeMPF(minMpf, avgMpf, maxMpf);
  }


  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);