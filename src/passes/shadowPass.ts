import * as THREE from "three/webgpu";
import { webGPUData } from "../utils/webgpu-data";
import {vertexBuffers } from "../utils/loader";

import shadowMapVertex from '../shader/shadow-map/shadowmap-vertex.wgsl?raw';
import shadowMapFragment from '../shader/shadow-map/shadowmap-fragment.wgsl?raw';
import { depthMap } from "./depthPass";
import { Scene } from "../scene/scene-types";
import { SceneBuffers } from "../scene/scene-buffers";
import { ConfigBuffers } from "../config/config-buffers";

const MAX_CASCADES = 8;

export type shadowPassResources = {
    pipeline: GPURenderPipeline;
    lightBindGroups: GPUBindGroup;
    entityBindGroups: GPUBindGroup[];
    // textures 
    depthTexture: GPUTexture;
};

export async function initShadowPass(
    gpu: webGPUData,
    scene: Scene, 
    d: depthMap, 
    buffers: SceneBuffers,
    configBuffers: ConfigBuffers,
    numOfCascades: number
) : Promise<shadowPassResources> {
    const { entities } = scene;
    const { cameraBuffer, snatchedLightBuffer, lightBufferOptions, objectBuffer } = buffers;
    const { configBuffer, configBufferSize } = configBuffers;
    const pipeline = gpu.device.createRenderPipeline({
        vertex: {
            module: gpu.device.createShaderModule({ code: shadowMapVertex }),
            entryPoint: 'main',
            buffers: vertexBuffers
        },
        fragment: {
            module: gpu.device.createShaderModule({ code: shadowMapFragment }),
            entryPoint: 'main',
            targets: [{ format: gpu.context.getCurrentTexture().format }]
        },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        layout: "auto",
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus-stencil8',
        },
    });

    const depthSampler = gpu.device.createSampler({
        compare: 'less'
    });

    const lightBindGroups = gpu.device.createBindGroup({
        label: "depthpass-lightBindGroups",
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: { buffer: snatchedLightBuffer, offset: 0, size: Float32Array.BYTES_PER_ELEMENT * 16 * MAX_CASCADES }
            },
            {
                binding: 1,
                resource: { buffer: lightBufferOptions }
            },
            {
                binding: 2,
                resource: { 
                    buffer: configBuffer, 
                    offset: 0,
                    size: configBufferSize,
                }
            }
        ]
    });
  
    // binds
    const entityBindGroups = entities.map((_, i) =>
        gpu.device.createBindGroup({
            label: "shadowpass-entityBindGroups" + i,
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: cameraBuffer
                },
                {
                    binding: 1,
                    resource: { 
                        buffer: objectBuffer, 
                        offset: i * 256,
                        size: 128,
                    }
                },
                {
                    binding: 2,
                    resource: d.depthTexture.createView({
                        dimension: '2d-array',
                        baseArrayLayer: 0,
                        arrayLayerCount: numOfCascades
                    })
                },
                {
                    binding: 3,
                    resource: depthSampler
                }
            ]
        })
        
    );

    const depthTexture = gpu.device.createTexture({
        size: [gpu.canvas.width, gpu.canvas.height, 1],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'depth24plus-stencil8',
    });
    
    return {
        pipeline, lightBindGroups, entityBindGroups, depthTexture
    }
}// depth pass

export async function shadowPass(
    resources: shadowPassResources,
    gpu: webGPUData,
    encoder: GPUCommandEncoder,
    scene: Scene
) {
    const { entities } = scene;
    const { pipeline, lightBindGroups, entityBindGroups, depthTexture } = resources;

    const renderPass = encoder.beginRenderPass({
        depthStencilAttachment: {
            view: depthTexture.createView(
                    {
                        baseArrayLayer: 0,
                        arrayLayerCount: 1,
                        dimension: '2d'
                    }
                ),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
            stencilClearValue: 0,
            stencilLoadOp: 'clear',
            stencilStoreOp: 'store',
        },
        colorAttachments: [{
            view: gpu.context.getCurrentTexture().createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 }
        }]
    });

    renderPass.setBindGroup(1, lightBindGroups);
    renderPass.setPipeline(pipeline);
    for (let j= 0; j < entities.length; ++j) {
        const { mesh } = entities[j];
        const group = entityBindGroups[j];
        renderPass.setVertexBuffer(0, mesh.vertexBuffer);
        renderPass.setBindGroup(0, group);
        if (mesh.indexBuffer) {
            renderPass.setIndexBuffer(mesh.indexBuffer, "uint16");
            renderPass.drawIndexed(mesh.indexCount);
        } else {
            renderPass.draw(mesh.vertexCount);
        }

    }
    renderPass.end();
}// depth pass