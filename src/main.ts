import { UI, UIFlags } from './UI/UI-flags-types';
import { changeFPS, changeMemory, changeMPF, initUInteractions } from './UI/UI';
import { initRender, renderFrame } from './render/renderer';
import { DynamicSystem } from './scene/movement/systems';
//import Stats from 'three/examples/jsm/libs/stats.module.js';
import { getWebGPUMemoryUsage } from 'https://greggman.github.io/webgpu-memory/dist/1.x/webgpu-memory.module.js';
import Stats from 'stats-gl';

function initExternal() {
    initUInteractions();
}

// ------ MAIN LOOP ------ //
// get render data
initExternal();
let renderData = await initRender(UI, UIFlags);
let system = new DynamicSystem(renderData.scene);

// statistics
const stats = new Stats({ trackGPU: true });
stats.init(renderData.gpu.device);
document.body.appendChild(stats.dom);

async function animate() {
    stats.begin();

    // run system
    system.update();

    // run render pipeline
    renderFrame(renderData, UI, UIFlags, stats);
    stats.update();
    // ------ PROFILING ------ //
    const info = getWebGPUMemoryUsage();
    changeMemory(info.memory.total, info.memory.buffer, info.memory.texture);
    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
