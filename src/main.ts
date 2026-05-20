import { UI, UIFlags } from "./UI/UI-flags-types";
import { changeFPS, changeMemory, changeMPF, initUInteractions } from "./UI/UI";
import { initRender, renderFrame } from "./render/renderer";
import { DynamicSystem } from "./scene/movement/systems";
import Stats from "three/examples/jsm/libs/stats.module.js";
import {getWebGPUMemoryUsage} from 'https://greggman.github.io/webgpu-memory/dist/1.x/webgpu-memory.module.js';

function initExternal() {
  initUInteractions();
}

// ------ MAIN LOOP ------ //

// statistics
var stats = new Stats();
stats.showPanel( 1 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );

// get render data
initExternal();
let renderData = await initRender(UI, UIFlags);
let system =  new DynamicSystem(renderData.scene);

async function animate() {
  // start profiling
  stats.begin();

  // run system
  system.update();

  // run render pipeline
  renderFrame(renderData, UI, UIFlags);

  // ------ PROFILING ------ //
  stats.end();
  const info = getWebGPUMemoryUsage();
  changeMemory(info.memory.total, info.memory.buffer, info.memory.texture);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);