import * as THREE from "three/webgpu";
import { pointLight, getVP, lightSource } from "./light";
import { webGPUData } from "./webgpu_data";
import { Entity, ModelBuffers, vertexBuffers } from "./loader";

import depthMapVertex from './shader/shadow-map/depthmap.wgsl?raw';
import shadowMapVertex from './shader/shadow-map/shadowmap-vertex.wgsl?raw';
import shadowMapFragment from './shader/shadow-map/shadowmap-fragment.wgsl?raw';
import { depthMap } from "./depthPass";

export interface shadowPassResources {
    pipeline: GPURenderPipeline;
    bindGroups: GPUBindGroup[];

    // buffers
    cameraBuffer: GPUBuffer;
    lightBuffer: GPUBuffer;
    objectBuffer: GPUBuffer;

    // textures 
    depthTexture: GPUTexture;
};

export async function initShadowPass(
    gpu: webGPUData,
    entities: Entity[],
    d: depthMap
) : Promise<shadowPassResources> {
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

    // camera buffer
    const cameraBuffer = gpu.device.createBuffer({
        size: (16 + 4) * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "cameraBuffer-shadowPass"
    });

    // light buffer
    const lightBuffer = gpu.device.createBuffer({
        size: (16 + 4 + 4) * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "lightBuffer-shadowPass"
    });
    
    // object buffers
    const objectBuffer = gpu.device.createBuffer({
        size: 256 * entities.length,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "objectBuffer-shadowPass"
    });

    // binds
    const bindGroups = entities.map((_, i) =>
        gpu.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: cameraBuffer
                },
                {
                    binding: 1,
                    resource: lightBuffer
                },
                {
                    binding: 2,
                    resource: { 
                        buffer: objectBuffer, 
                        offset: i * 256,
                        size: 128,
                    }
                },
                {
                    binding: 3,
                    resource: d.depthTextureView
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
    
    return {
        pipeline, bindGroups, lightBuffer, objectBuffer, cameraBuffer, depthTexture
    }
}// depth pass

export async function shadowPass(
    resources: shadowPassResources,
    gpu: webGPUData,
    encoder: GPUCommandEncoder,
    d: depthMap,
    entities: Entity[], /// scene
    light: pointLight, /// scene 
    camera: THREE.Camera /// scene 
) {
    const { depthTextureView } = d;
    const { pipeline, bindGroups, cameraBuffer, lightBuffer, objectBuffer, depthTexture } = resources;

    // camera buffer
    const cameraMatrixArray =  new Float32Array(16 + 4);
    cameraMatrixArray.set(getVP(gpu, camera), 0);
    cameraMatrixArray.set([camera.position.x, camera.position.y, camera.position.z, 1.0], 16);
    gpu.device.queue.writeBuffer(cameraBuffer, 0, cameraMatrixArray);

    // light buffer
    const lightMatrixArray =  new Float32Array(16 + 4 + 4);
    lightMatrixArray.set(getVP(gpu, light.camera), 0);
    lightMatrixArray.set([light.direction.x, light.direction.y, light.direction.z, 1.0], 16);
    lightMatrixArray.set([light.position.x, light.position.y, light.position.z, 1.0], 16 + 4);
    gpu.device.queue.writeBuffer(lightBuffer, 0, lightMatrixArray);

    // object buffers
    const modelMatrixArray =  new Float32Array(entities.length * 64);
    for (let i = 0; i < entities.length; i++) {
        const modelMatrix = entities[i].modelMatrix;
        const normalMatrix = modelMatrix.clone().invert().transpose();
        modelMatrixArray.set(modelMatrix.toArray(), i * 64);
        modelMatrixArray.set(normalMatrix.toArray(), i * 64 + 16);
    }
    gpu.device.queue.writeBuffer(
        objectBuffer,
        0,
        modelMatrixArray
    );

    // const depthTexture = gpu.device.createTexture({
    //     size: [gpu.canvas.width, gpu.canvas.height, 1],
    //     usage: GPUTextureUsage.RENDER_ATTACHMENT,
    //     format: 'depth24plus-stencil8',
    // });

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
            clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 }
        }]
    });

    renderPass.setPipeline(pipeline);
    for (let i = 0; i < entities.length; ++i) {
        const { mesh } = entities[i];
        const group = bindGroups[i];
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