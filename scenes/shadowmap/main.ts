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
import { cameraWhat, renderWhat, resetAllFlags, UI, UICameraBufferChanged, UIChangedToReinit, UIConfigChanged, UILightBufferChanged } from "./UIcontroller";
import { changeFPS, changeMPF, initUInteractions } from "./UI";
import { Scene } from "../../src/scene/scene-types";
import { ConfigBuffers, createConfigBuffers, fillConfigBuffers } from "../../src/config/config-buffers";
import { Stats } from "../../src/utils/stats";


export type RenderInfo = {
  gpu: webGPUData,
  mainConfig: CameraConfig,
  scene: Scene,
  sceneBuffers: SceneBuffers,
  configBuffers: ConfigBuffers,
  depthMap: depthMap,
  depthPassResources: depthPassResources,
  shadowPassResources: shadowPassResources,
  renderDepthPassResources: renderDepthPassResources,
}

async function updateData(renderData: RenderInfo) {
  //load config
  if (UIConfigChanged.configChanged) {
    fillConfigBuffers(
      renderData.gpu,
      renderData.configBuffers,
      UI.shadowMap,
      UI.numberOfSamples,
      UI.numOfCascades,
      UI.biasType,
      UI.biasValue,
      UI.lightOn,
      UI.cascadeLayers,
      UI.lightAmbient
    );
  }

  // change camera if needed
  if (UICameraBufferChanged.cameraType) {
    renderData.mainConfig.controls.disconnect();
    if (UI.cameraType == cameraWhat.Orthographic) {
      renderData.mainConfig.camera = addCamera(renderData.gpu.canvas, CameraType.Orthographic);;
      renderData.mainConfig.controls = setControls(renderData.gpu.canvas, renderData.mainConfig.camera);
    } else {
      renderData.mainConfig.camera = addCamera(renderData.gpu.canvas, CameraType.Perspective);
      renderData.mainConfig.controls = setControls(renderData.gpu.canvas, renderData.mainConfig.camera);
    }
    renderData.mainConfig.controls.connect(renderData.gpu.canvas);
    UICameraBufferChanged.cameraType = false;

    renderData.mainConfig.controls.update();
  }

  // load light data
  if (UILightBufferChanged.direction) {
    renderData.scene.light.direction = UI.direction;
    UILightBufferChanged.direction = false;
  }
  renderData.scene.light.update(
    renderData.mainConfig.camera,
    UI.numOfCascades,
    UI.depthPassSize, 
    UI.lambda
  );

  // reinit
  if (UIChangedToReinit.depthPassSize || UIChangedToReinit.numOfCascades) {
    renderData.depthMap = getDepthMap(renderData.gpu, UI.depthPassSize, UI.numOfCascades);
    renderData.depthPassResources = await initDepthPass(
      renderData.gpu,
      renderData.scene,
      renderData.sceneBuffers.lightBuffer,
      renderData.sceneBuffers.objectBuffer,
      renderData.configBuffers,
      UI.numOfCascades
    );
    renderData.shadowPassResources = await initShadowPass(
      renderData.gpu,
      renderData.scene,
      renderData.depthMap,
      renderData.sceneBuffers,
      renderData.configBuffers,
      UI.numOfCascades
    );
    UIChangedToReinit.depthPassSize = false;
    UIChangedToReinit.numOfCascades = false;
  }

  if (UIChangedToReinit.depthMapCascade) {
    renderData.renderDepthPassResources = await initRenderDepthPass(
      renderData.gpu,
      renderData.depthMap,
      UI.depthMapCascade
    );
    UIChangedToReinit.depthMapCascade = false;
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
  let perspectiveCamera = addCamera(gpu.canvas, CameraType.Perspective);
  let mainConfig = {
    camera: perspectiveCamera,
    controls: setControls(gpu.canvas, perspectiveCamera)
  }

  // light source
  const light = new DirectionalLight(mainConfig.camera, UI.numOfCascades);
  light.direction = UI.direction;

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

  // ------ init renderpass data ------ //
  // create buffers
  const sceneBuffers = createSceneBuffers(gpu, scene);
  const configBuffer = createConfigBuffers(gpu);

  //load buffers
  fillConfigBuffers(
    gpu,
    configBuffer,
    UI.shadowMap,
    UI.numberOfSamples,
    UI.numOfCascades,
    UI.biasType,
    UI.biasValue,
    UI.lightOn,
    UI.cascadeLayers,
    UI.lightAmbient
  );
  fillSceneBuffers(
    gpu,
    sceneBuffers,
    scene,
    mainConfig.camera,
    UI.numOfCascades,
    { camera: true, light: true, object: true }
  );

  // create resources
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

  let renderData = {
    gpu: gpu,
    mainConfig: mainConfig,
    scene: scene,
    sceneBuffers: sceneBuffers,
    configBuffers: configBuffer,
    depthMap: depthMap,
    depthPassResources: depthPassResources,
    shadowPassResources: shadowPassResources,
    renderDepthPassResources: renderDepthPassResources,
  };
  updateData(renderData);
  return renderData;
}

async function renderColor(renderData: RenderInfo, encoder: GPUCommandEncoder) {
  let { gpu, renderDepthPassResources, shadowPassResources, scene } = renderData;
  if (UI.renderWhat == renderWhat.depthMap) {
    await renderDepthPass(renderDepthPassResources, gpu, encoder);
  } else {
    await shadowPass(shadowPassResources, gpu, encoder, scene);
  }
}

// ------ MAIN LOOP ------ //

// statistics
let stats = new Stats();

// get render data
initExternal();
let renderData = await initRender();

// if device lost
// var deviceLost = false;
// async function handleDeviceLost() {
//   const info = await renderData.gpu.device.lost;
//   console.error(`WebGPU device lost: ${info.message}`, info);
//   if (info.reason !== "destroyed") {
//     renderData.gpu.device.destroy();
//     renderData = await initRender();
//     handleDeviceLost();
//   }
// }
// handleDeviceLost();

async function animate() {
  // if(deviceLost) {
  //   requestAnimationFrame(animate);
  //   return;
  // }

  // update settings
  updateData(renderData);

  // start profiling
  stats.start();

  // run render pipeline
  const encoder = renderData.gpu.device.createCommandEncoder();
  fillSceneBuffers(renderData.gpu, renderData.sceneBuffers, renderData.scene, renderData.mainConfig.camera, UI.numOfCascades, { camera: true, light: true, object: false });
  await depthPass(renderData.depthMap, renderData.depthPassResources, renderData.gpu, encoder, renderData.scene, UI.numOfCascades);
  await renderColor(renderData, encoder);
  renderData.gpu.device.queue.submit([encoder.finish()]);

  // ------ PROFILING ------ //
  let elapsed = stats.end();
  if (elapsed) {
    changeFPS(stats.fps);
    changeMPF(stats.avgMpf);
  }

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);