import { UI, UIFlags } from "./UI/UI-flags-types";
import { changeFPS, changeMPF, initUInteractions } from "./UI/UI";
import { Stats } from "./utils/stats";
import { initRender, renderFrame } from "./render/renderer";
import { Path } from "./scene/movement/path";
import { DynamicSystem } from "./scene/movement/systems";

function initExternal() {
  initUInteractions();
}

// ------ MAIN LOOP ------ //

// statistics
let stats = new Stats();

// get render data
initExternal();
let renderData = await initRender(UI, UIFlags);
let system =  new DynamicSystem(renderData.scene);

async function animate() {
  // start profiling
  stats.start();

  // run system
  system.update();

  // run render pipeline
  renderFrame(renderData, UI, UIFlags);

  // ------ PROFILING ------ //
  let elapsed = stats.end();
  if (elapsed) {
    changeFPS(stats.fps);
    changeMPF(stats.avgMpf);
  }

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);