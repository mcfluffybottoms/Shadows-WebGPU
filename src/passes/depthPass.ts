import * as THREE from "three/webgpu";
import { webGPUData } from "../utils/webgpu-data";
import { vertexBuffers } from "../utils/loader";

import depthMapVertex from '../shader/shadow-map/depthmap.wgsl?raw';
import { Scene } from "../scene/scene-types";
import { ConfigBuffers } from "../config/config-buffers";

export type depthMap = {
    depthTextureSize: number;
    depthTexture: GPUTexture;
};

export function getDepthMap(
    gpu: webGPUData,
    depthTextureSize: number,
    numOfTextures: number
) : depthMap {
    const depthTexture = gpu.device.createTexture({
        size: [depthTextureSize, depthTextureSize, numOfTextures],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float',
    });
    return { depthTextureSize, depthTexture };
}

export interface depthPassResources {
    pipeline: GPURenderPipeline;
    lightBindGroups: GPUBindGroup[];
    entityBindGroups: GPUBindGroup[]
};

export async function initDepthPass(
    gpu: webGPUData,
    scene: Scene, 
    cameraBuffer: GPUBuffer,
    objectBuffer: GPUBuffer,
    configBuffers: ConfigBuffers,
    numOfCascades: number
) : Promise<depthPassResources> {
    const { configBuffer, configBufferSize } = configBuffers;

    // get uniform values for depth map render pipeline
    const { entities } = scene;
    const pipeline = gpu.device.createRenderPipeline({
        vertex: {
            module: gpu.device.createShaderModule({ code: depthMapVertex }),
            entryPoint: 'main',
            buffers: vertexBuffers
        },
        depthStencil: {
            format: 'depth32float',
            depthWriteEnabled: true,
            depthCompare: "less",
        }, 
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        layout: "auto",
    });

    const lightBindGroups: GPUBindGroup[] = [];
    for (let i = 0; i < numOfCascades; i++) {
        lightBindGroups.push(gpu.device.createBindGroup({
            label: "depthpass-lightBindGroups" + i,
            layout: pipeline.getBindGroupLayout(1),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: cameraBuffer, offset: i * 256, size: 64, }
                }
            ]
        }));
    }
    
    // set up bind grops for each entity
    const entityBindGroups = entities.map((_, i) =>
        gpu.device.createBindGroup({
            label: "depthpass-entityBindGroups" + i,
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: objectBuffer,
                        offset: i * 256,
                        size: 64,
                    }
                },
                {
                    binding: 1,
                    resource: { 
                        buffer: configBuffer, 
                        offset: 0,
                        size: configBufferSize,
                    }
                }
            ]
        })
    );

    return { pipeline, lightBindGroups, entityBindGroups };
}

export async function depthPass(
    d: depthMap,
    resources: depthPassResources,
    gpu: webGPUData,
    encoder: GPUCommandEncoder,
    scene: Scene,
    numOfCascades: number
) {
    // get uniform values for depth map render pipeline
    const { pipeline, lightBindGroups, entityBindGroups } = resources;
    const { entities } = scene;

    // begin render pass
    for (let i = 0; i < numOfCascades; ++i) {
        const depthPass = encoder.beginRenderPass({
            depthStencilAttachment: {
                view: d.depthTexture.createView(
                    {
                        baseArrayLayer: i,
                        arrayLayerCount: 1,
                        dimension: '2d'
                    }
                ),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            },
            colorAttachments: []
        });

        const lightGroup = lightBindGroups[i];

        depthPass.setViewport(0, 0, d.depthTextureSize, d.depthTextureSize, 0, 1);
        depthPass.setPipeline(pipeline);
        for (let j = 0; j < entities.length; ++j) {
            const { mesh } = entities[j];
            const group = entityBindGroups[j];
            depthPass.setBindGroup(0, group);
            depthPass.setBindGroup(1, lightGroup);

            depthPass.setVertexBuffer(0, mesh.vertexBuffer);
            if (mesh.indexBuffer) {
                depthPass.setIndexBuffer(mesh.indexBuffer, "uint16");
                depthPass.drawIndexed(mesh.indexCount);
            } else {
                depthPass.draw(mesh.vertexCount);
            }
        }
        
        depthPass.end();
    }
}