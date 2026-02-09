import { getVP, lightSource } from "./light";
import { Entity } from "./loader";
import { shadowMap } from "./shadow";
import { webGPUData } from "./webgpu_data";

import debugDepthVertex from './shader/shadow-map/debug-depth-map.wgsl?raw';
import debugDepthFragment from './shader/shadow-map/debug-depth-map-frag.wgsl?raw';

export async function renderDepthPass(
    s: shadowMap,
    gpu: webGPUData,
    entities: Entity[],
    depthMapData: {
        depthTexture: GPUTexture,
        shadowDepthTextureView: GPUTextureView
    },
    encoder: GPUCommandEncoder,
    light: lightSource
) {
    const { depthTexture, shadowDepthTextureView } = depthMapData;

    // get uniform values for depth map render pipeline
    const depthMapDebugPipeline = gpu.device.createRenderPipeline({
        vertex: {
            module: gpu.device.createShaderModule({ code: debugDepthVertex }),
            entryPoint: 'main'
        },
        fragment: {
            module: gpu.device.createShaderModule({ code: debugDepthFragment }),
            entryPoint: 'main',
            targets: [{ format: gpu.context.getCurrentTexture().format }]
        },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        layout: "auto",
    });

    const depthSampler = gpu.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear'
    });

    // connects shader to light perspective
    const lightBuffer = gpu.device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const matrixArray = getVP(gpu, light.camera);
    gpu.device.queue.writeBuffer(lightBuffer, 0, matrixArray);

    const objectBindGroup =  gpu.device.createBindGroup({
        layout: depthMapDebugPipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: shadowDepthTextureView
            },
            {
                binding: 1,
                resource: depthSampler
            }
        ]
    });

    const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
            view: gpu.context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 }
        }]
    });
    renderPass.setPipeline(depthMapDebugPipeline);
    renderPass.setBindGroup(0, objectBindGroup);
    renderPass.draw(6);
    renderPass.end();
}