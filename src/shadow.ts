import * as THREE from "three/webgpu";
import { pointLight, getVP, lightSource } from "./light";
import { webGPUData } from "./webgpu_data";
import { Entity, ModelBuffers, vertexBuffers } from "./loader";

import depthMapVertex from './shader/shadow-map/depthmap.wgsl?raw';
import shadowMapVertex from './shader/shadow-map/shadowmap-vertex.wgsl?raw';
import shadowMapFragment from './shader/shadow-map/shadowmap-fragment.wgsl?raw';

export interface shadowMap {
    color?: number | undefined;
    intensity?: number | undefined;
    position?: THREE.Vector3 | undefined;
    target?: THREE.Vector3 | undefined;

    shadowDepthTextureSize: number;
};

export function getDepthMap(
    s: shadowMap,
    gpu: webGPUData
) {
    const depthTexture = gpu.device.createTexture({
        size: [s.shadowDepthTextureSize, s.shadowDepthTextureSize, 1],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float',
    });
    const shadowDepthTextureView = depthTexture.createView();
    return { depthTexture, shadowDepthTextureView };
}

export async function depthPass(
    s: shadowMap,
    gpu: webGPUData,
    entities: Entity[],
    encoder: GPUCommandEncoder,
    light: pointLight
) {
    // get depth map
    const { depthTexture, shadowDepthTextureView } = getDepthMap(s, gpu);

    // get uniform values for depth map render pipeline
    const depthMapPipeline = gpu.device.createRenderPipeline({
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

    // connects shader to light perspective
    const lightBuffer = gpu.device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const matrixArray = getVP(gpu, light.camera);
    gpu.device.queue.writeBuffer(lightBuffer, 0, matrixArray);

    const OBJECT_STRIDE = 256;
    const objectBuffer = gpu.device.createBuffer({
        size: OBJECT_STRIDE * entities.length,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    for (let i = 0; i < entities.length; i++) {
        const modelMatrix = entities[i].modelMatrix;

        gpu.device.queue.writeBuffer(
            objectBuffer,
            i * OBJECT_STRIDE,
            new Float32Array(modelMatrix.toArray())
        );
    }

    const objectBindGroups = entities.map((_, i) =>
        gpu.device.createBindGroup({
            layout: depthMapPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: lightBuffer
                },
                {
                    binding: 1,
                    resource: {
                        buffer: objectBuffer,
                        offset: i * OBJECT_STRIDE,
                        size: 64,
                    }
                }
            ]
        })
    );

    // depth pass
    const depthPass = encoder.beginRenderPass({
        depthStencilAttachment: {
            view: shadowDepthTextureView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
        },
        colorAttachments: []
    });
    depthPass.setPipeline(depthMapPipeline);
    for (let i = 0; i < entities.length; ++i) {
        const { mesh } = entities[i];
        depthPass.setVertexBuffer(0, mesh.vertexBuffer);
        depthPass.setBindGroup(0, objectBindGroups[i]);
        if (mesh.indexBuffer) {
            depthPass.setIndexBuffer(mesh.indexBuffer, "uint16");
            depthPass.drawIndexed(mesh.indexCount);
        } else {
            depthPass.draw(mesh.vertexCount);
        }
    }
    depthPass.end();

    return { depthTexture, shadowDepthTextureView };
}

export async function shadowPass(
    s: shadowMap,
    gpu: webGPUData,
    entities: Entity[],
    depthMapData: {
        depthTexture: GPUTexture,
        shadowDepthTextureView: GPUTextureView
    },
    encoder: GPUCommandEncoder,
    light: pointLight,
    camera: THREE.Camera
) {
    const { shadowDepthTextureView } = depthMapData;

    // get uniform values for depth map render pipeline
    const shadowPassPipeline = gpu.device.createRenderPipeline({
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

    // camera buffer
    const cameraBuffer = gpu.device.createBuffer({
        size: 64 + 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const matrixArray1 = getVP(gpu, camera);
    gpu.device.queue.writeBuffer(cameraBuffer, 0, matrixArray1);
    gpu.device.queue.writeBuffer(cameraBuffer, 64, new Float32Array([camera.position.x, camera.position.y, camera.position.z, 1.0]));

    // light buffer
    const lightBuffer = gpu.device.createBuffer({
        size: 64 + 16 + 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const matrixArray2 = getVP(gpu, light.camera);
    gpu.device.queue.writeBuffer(lightBuffer, 0, matrixArray2);
    gpu.device.queue.writeBuffer(lightBuffer, 64 , new Float32Array([light.direction.x, light.direction.y, light.direction.z, 1.0]));
    gpu.device.queue.writeBuffer(lightBuffer, 64 + 16, new Float32Array([light.position.x, light.position.y, light.position.z, 1.0]));
    
    // object buffers
    const OBJECT_STRIDE = 256;
    const objectBuffer = gpu.device.createBuffer({
        size: OBJECT_STRIDE * entities.length,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    for (let i = 0; i < entities.length; i++) {
        const modelMatrix = entities[i].modelMatrix;
        gpu.device.queue.writeBuffer(
            objectBuffer,
            i * OBJECT_STRIDE,
            new Float32Array(modelMatrix.toArray())
        );
        const normalMatrix = modelMatrix.clone().invert().transpose();
        gpu.device.queue.writeBuffer(
            objectBuffer,
            i * OBJECT_STRIDE + 64,
            new Float32Array(normalMatrix.toArray())
        );
    }

    // binds
    const objectBindGroups = entities.map((_, i) =>
        gpu.device.createBindGroup({
            layout: shadowPassPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: cameraBuffer, size: 64 + 16 }
                },
                {
                    binding: 1,
                    resource: { buffer: lightBuffer, size: 64 + 16 + 16 }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: objectBuffer,
                        offset: i * OBJECT_STRIDE,
                        size: 128,
                    }
                },
                {
                    binding: 3,
                    resource: shadowDepthTextureView
                },
                {
                    binding: 4,
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
    const renderPass = encoder.beginRenderPass({
        depthStencilAttachment: {
            view: depthTexture.createView(),
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
            clearValue: { r: 0.0, g: 1.0, b: 1.0, a: 1.0 }
        }]
    });
    renderPass.setPipeline(shadowPassPipeline);
    for (let i = 0; i < entities.length; ++i) {
        const { mesh } = entities[i];
        renderPass.setVertexBuffer(0, mesh.vertexBuffer);
        renderPass.setBindGroup(0, objectBindGroups[i]);
        if (mesh.indexBuffer) {
            renderPass.setIndexBuffer(mesh.indexBuffer, "uint16");
            renderPass.drawIndexed(mesh.indexCount);
        } else {
            renderPass.draw(mesh.vertexCount);
        }

    }
    renderPass.end();
}