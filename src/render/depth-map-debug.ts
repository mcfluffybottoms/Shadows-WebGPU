import { WebGPUData } from "../utils/webgpu-data";
import { DepthMap } from "./depth-pass";
import { debugDepthFragment, debugDepthVertex } from "./imported-shaders";

export type renderDepthPassResources = {
    pipeline: GPURenderPipeline;
    bindGroup: GPUBindGroup;
};

export async function initRenderDepthPass(
    gpu: WebGPUData,
    d: DepthMap,
    depthMapCascade: number
) : Promise<renderDepthPassResources> {
    const { depthTexture } = d;

    const pipeline = gpu.device.createRenderPipeline({
        label: "RenderDepthPass",
        vertex: {
            module: gpu.device.createShaderModule({ code: debugDepthVertex, label: "debugDepthVertex" }),
            entryPoint: 'main'
        },
        fragment: {
            module: gpu.device.createShaderModule({ code: debugDepthFragment, label: "debugDepthFragment" }),
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
                        baseArrayLayer: depthMapCascade - 1,
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
    gpu: WebGPUData,
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