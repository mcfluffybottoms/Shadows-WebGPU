import { getVP, lightSource } from "./light";
import { webGPUData } from "./webgpu_data";
import { depthMap } from "./depthPass";

import debugDepthVertex from './shader/shadow-map/debug-depth-map.wgsl?raw';
import debugDepthFragment from './shader/shadow-map/debug-depth-map-frag.wgsl?raw';

export interface renderDepthPassResources {
    pipeline: GPURenderPipeline;
    bindGroup: GPUBindGroup;

    // buffers
    lightBuffer: GPUBuffer;
};

export async function initRenderDepthPass(
    gpu: webGPUData,
    d: depthMap
) : Promise<renderDepthPassResources> {
    const { depthTextureView } = d;

    const pipeline = gpu.device.createRenderPipeline({
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

    const lightBuffer = gpu.device.createBuffer({
        size: 16 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup =  gpu.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: depthTextureView
            },
            {
                binding: 1,
                resource: gpu.device.createSampler()
            }
        ]
    });

    return { pipeline, lightBuffer, bindGroup };
}
export async function renderDepthPass(
    resources: renderDepthPassResources,
    gpu: webGPUData,
    d: depthMap,
    encoder: GPUCommandEncoder,
    light: lightSource
) {
    const { depthTextureView } = d;
    const { pipeline, lightBuffer, bindGroup } = resources;

    // connects shader to light perspective
    const matrixArray = getVP(gpu, light.camera);
    gpu.device.queue.writeBuffer(lightBuffer, 0, matrixArray);

    const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
            view: gpu.context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 }
        }]
    });
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6);
    renderPass.end();
}