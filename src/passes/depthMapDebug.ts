import { LightSource } from "../scene/light-types";
import { webGPUData } from "../utils/webgpu-data";
import { depthMap } from "./depthPass";

import debugDepthVertex from '../shader/shadow-map/debug-depth-map.wgsl?raw';
import debugDepthFragment from '../shader/shadow-map/debug-depth-map-frag.wgsl?raw';

export type renderDepthPassResources = {
    pipeline: GPURenderPipeline;
    bindGroup: GPUBindGroup;
};

export async function initRenderDepthPass(
    gpu: webGPUData,
    d: depthMap
) : Promise<renderDepthPassResources> {
    const { depthTexture } = d;

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

    const bindGroup =  gpu.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: depthTexture.createView({
                        baseArrayLayer: 0,
                        arrayLayerCount: 1,
                        dimension: '2d'
                    })
            },
            {
                binding: 1,
                resource: gpu.device.createSampler()
            }
        ]
    });

    return { pipeline, bindGroup };
}
export async function renderDepthPass(
    resources: renderDepthPassResources,
    gpu: webGPUData,
    encoder: GPUCommandEncoder
) {
    const { pipeline, bindGroup } = resources;

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
    renderPass.draw(6 * 4);
    renderPass.end();
}