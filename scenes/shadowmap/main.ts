import * as THREE from "three/webgpu";
import {
  createEntityFromGeometry,
  getModelBuffers,
  loadAndAddObject,
} from "../../src/utils/loader";
import { getWebGPU, webGPUData } from "../../src/utils/webgpu-data";
import { DirectionalLight } from "../../src/scene/light-types";
import { initRenderDepthPass, renderDepthPass, renderDepthPassResources } from "../../src/passes/depthMapDebug";
import { depthMap, depthPass, depthPassResources, getDepthMap, initDepthPass } from "../../src/passes/depthPass";
import { initShadowPass, shadowPass, shadowPassResources } from "../../src/passes/shadowPass";
import { createSceneBuffers, fillSceneBuffers, SceneBuffers } from "../../src/scene/scene-buffers";
import { addCamera, CameraConfig, CameraType, setControls } from "../../src/utils/camera-utils";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { cameraWhat, changeConfig, controllingWhat, renderWhat, UI, UIchanged } from "./UIcontroller";
import { changeFPS, changeMPF, initUInteractions } from "./UI";
import { Scene } from "../../src/scene/scene-types";
import { ConfigBuffers, createConfigBuffers } from "../../src/config/config-buffers";
import { Stats } from "../../src/utils/stats";


export type RenderInfo = {
  gpu: webGPUData,
  orthoConfig: CameraConfig,
  perspectiveConfig: CameraConfig,
  mainConfig: CameraConfig,
  scene: Scene,
  sceneBuffers: SceneBuffers,
  configBuffers: ConfigBuffers,
  depthMap: depthMap,
  depthPassResources: depthPassResources,
  shadowPassResources: shadowPassResources,
  renderDepthPassResources: renderDepthPassResources,
}

function updateCamera(
  canvas: HTMLCanvasElement,
  renderInfo: RenderInfo
) {
  let {camera: orthoCamera, controls: orthoControls} = renderInfo.orthoConfig;
  let {camera: perspectiveCamera, controls: perspectiveControls} = renderInfo.perspectiveConfig;
  let {camera: mainCamera, controls: mainControls} = renderInfo.mainConfig;
  if (UIchanged.cameraWhat) {
    mainControls.disconnect();
    if (UI.cameraWhat == cameraWhat.Orthographic) {
      mainCamera = orthoCamera;
      mainControls = orthoControls;
    } else {
      mainCamera = perspectiveCamera;
      mainControls = perspectiveControls;
    }
    mainControls.connect(canvas);
    UIchanged.cameraWhat = false;
  }
}

// ----- INIT ----- //
function initExternal() {
  initUInteractions();
}

async function initRender(): Promise<RenderInfo> {
  // ---- get webgpu data ---- //
  const gpu = await getWebGPU();

  // camera
  let orthoCamera = addCamera(gpu.canvas, CameraType.Orthographic);
  let orthoConfig = {
    camera: orthoCamera,
    controls: setControls(gpu.canvas, orthoCamera)
  }
  let perspectiveCamera = addCamera(gpu.canvas, CameraType.Perspective);
  let perspectiveConfig = {
    camera: perspectiveCamera,
    controls: setControls(gpu.canvas, perspectiveCamera)
  }

  let mainConfig = perspectiveConfig;
  
  // light source
  const light = new DirectionalLight(mainConfig.camera, UI.numOfCascades);

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

  const scene = {
    entities, light, camera: mainConfig.camera
  };

  // load scene buffer
  const sceneBuffers = createSceneBuffers(gpu, scene);

  // ------ init renderpass data ------ //
  // config
  const configBuffer = createConfigBuffers(gpu);
  var depthMap = getDepthMap(gpu, UI.depthPassSize, UI.numOfCascades);
  var depthPassResources = await initDepthPass(
    gpu, 
    scene, 
    sceneBuffers.lightBuffer, 
    sceneBuffers.objectBuffer, 
    configBuffer, 
    UI.numOfCascades
  );
  var shadowPassResources = await initShadowPass(
    gpu, scene, 
    depthMap, 
    sceneBuffers, 
    configBuffer, 
    UI.numOfCascades
  );
  var renderDepthPassResources = await initRenderDepthPass(
    gpu, 
    depthMap, 
    UI.depthMapCascade
  );
  fillSceneBuffers(
    gpu, 
    sceneBuffers, 
    scene,
    mainConfig.camera,
    UI.numOfCascades, 
    {camera: true, light: true, object: true}
  );
  return {
      gpu: gpu,
      orthoConfig: orthoConfig,
      perspectiveConfig: perspectiveConfig,
      mainConfig: mainConfig,
      scene: scene,
      sceneBuffers: sceneBuffers,
      configBuffers: configBuffer,
      depthMap: depthMap,
      depthPassResources: depthPassResources,
      shadowPassResources: shadowPassResources,
      renderDepthPassResources: renderDepthPassResources,
  }
}

async function renderColor(renderData: RenderInfo, encoder: GPUCommandEncoder) {
  let {gpu, renderDepthPassResources, shadowPassResources, scene} = renderData;
  if (UI.renderWhat == renderWhat.depthMap) {
    await renderDepthPass(renderDepthPassResources, gpu, encoder);
  } else {
    await shadowPass(shadowPassResources, gpu, encoder, scene, UI.numOfCascades);
  }
}

async function updateSettings(renderData: RenderInfo) {
  let {gpu, depthMap, depthPassResources, renderDepthPassResources, shadowPassResources, sceneBuffers, configBuffers, scene} = renderData;
  if (UIchanged.depthPassSizeChanged || UIchanged.configChanged) {
    depthMap = getDepthMap(gpu, UI.depthPassSize, UI.numOfCascades);
    depthPassResources = await initDepthPass(gpu, scene, sceneBuffers.lightBuffer, sceneBuffers.objectBuffer, configBuffers, UI.numOfCascades);
    shadowPassResources = await initShadowPass(gpu, scene, depthMap, sceneBuffers, configBuffers, UI.numOfCascades);
    renderDepthPassResources = await initRenderDepthPass(gpu, depthMap, UI.depthMapCascade);
    UIchanged.depthPassSizeChanged = false;
  }
  changeConfig(gpu, configBuffers);
  updateCamera(gpu.canvas, renderData);
}

function changeDirection(light: DirectionalLight) : boolean {
    light.direction = UI.direction;
    UIchanged.directionChanged = false;
    return true;
}

// ------ MAIN LOOP ------ //

// statistics
let stats = new Stats();

// get render data
initExternal();
let renderData = await initRender();

// if device lost
var deviceLost = false;
async function handleDeviceLost(device: GPUDevice) {
  const info = await device.lost;
  console.error(`WebGPU device lost: ${info.message}`, info);
  deviceLost = true;
  if (info.reason !== "destroyed") {
    //destroy(renderData);
    renderData = await initRender();
    deviceLost = false;
    handleDeviceLost(renderData.gpu.device);
  }
}
handleDeviceLost(renderData.gpu.device);

async function animate() {
  // if(deviceLost) {
  //   requestAnimationFrame(animate);
  //   return;
  // }
  
  // get data
  let {
    gpu, 
    depthMap, 
    depthPassResources, 
    sceneBuffers, 
    scene
  } = renderData;
  const camera = renderData.mainConfig.camera;

  // update settings
  await updateSettings(renderData);
  if(UIchanged.directionChanged) changeDirection(renderData.scene.light);
  renderData.scene.light.update(camera, UI.numOfCascades, UI.depthPassSize);

  // start profiling
  stats.start();

  // run render pipeline
  const encoder = gpu.device.createCommandEncoder();
  fillSceneBuffers(gpu, sceneBuffers, scene, camera, UI.numOfCascades, {camera: true, light: true, object: false});
  await depthPass(depthMap, depthPassResources, gpu, encoder, scene, UI.numOfCascades);
  await renderColor(renderData, encoder);

  try {
    gpu.device.queue.submit([encoder.finish()]);
  } catch(e) {
    console.error("Queue submit error: ", e);
  }

  // ------ PROFILING ------ //
  let elapsed = stats.end();
  if(elapsed) {
    changeFPS(stats.fps);
    changeMPF(stats.avgMpf);
  }
  
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);