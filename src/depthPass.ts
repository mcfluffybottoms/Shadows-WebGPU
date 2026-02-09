import * as THREE from "three/webgpu";
import { pointLight, getVP, lightSource } from "./light";
import { webGPUData } from "./webgpu_data";
import { Entity, ModelBuffers, vertexBuffers } from "./loader";

import depthMapVertex from './shader/shadow-map/depthmap.wgsl?raw';

export interface depthMap {
    depthTextureSize: number;
    depthTexture: GPUTexture;
    depthTextureView: GPUTextureView;
};

export function getDepthMap(
    gpu: webGPUData,
    depthTextureSize: number
) : depthMap {
    const depthTexture = gpu.device.createTexture({
        size: [depthTextureSize, depthTextureSize, 1],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float',
    });
    const depthTextureView = depthTexture.createView();
    return { depthTextureSize, depthTexture, depthTextureView };
}

export interface depthPassResources {
    pipeline: GPURenderPipeline;
    bindGroups: GPUBindGroup[];

    // buffers
    lightBuffer: GPUBuffer;
    objectBuffer: GPUBuffer;
};

export async function initDepthPass(
    gpu: webGPUData,
    entities: Entity[]
) : Promise<depthPassResources> {
    // get uniform values for depth map render pipeline
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

    // create buffers
    const lightBuffer = gpu.device.createBuffer({
        size: 16 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "lightBuffer-DepthPass"
    });
    const objectBuffer = gpu.device.createBuffer({
        size: 256 * entities.length,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "objectBuffer-DepthPass"
    });
    
    // set up bind grops for each entity
    const bindGroups = entities.map((_, i) =>
        gpu.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: lightBuffer
                },
                {
                    binding: 1,
                    resource: {
                        buffer: objectBuffer,
                        offset: i * 256,
                        size: 64,
                    }
                }
            ]
        })
    );

    return { pipeline, bindGroups, lightBuffer, objectBuffer };
}

export async function depthPass(
    d: depthMap,
    resources: depthPassResources,
    gpu: webGPUData,
    entities: Entity[],
    encoder: GPUCommandEncoder,
    light: pointLight
) {
    // get uniform values for depth map render pipeline
    const { pipeline, bindGroups, lightBuffer, objectBuffer } = resources;

    // get data for buffer
        // light
    const lightArray = getVP(gpu, light.camera);
    gpu.device.queue.writeBuffer(lightBuffer, 0, lightArray);
        // model data
    const modelMatrixArray =  new Float32Array(entities.length * 64);
    for (let i = 0; i < entities.length; i++) {
        const modelMatrix = entities[i].modelMatrix;
        modelMatrixArray.set(modelMatrix.toArray(), i * 64);
    }

    gpu.device.queue.writeBuffer(
        objectBuffer,
        0,
        modelMatrixArray
    );

    // begin render pass
    const depthPass = encoder.beginRenderPass({
        depthStencilAttachment: {
            view: d.depthTextureView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
        },
        colorAttachments: []
    });

    depthPass.setPipeline(pipeline);
    for (let i = 0; i < entities.length; ++i) {
        const { mesh } = entities[i];
        const group = bindGroups[i];
        depthPass.setBindGroup(0, group);

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