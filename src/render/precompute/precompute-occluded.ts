import * as THREE from 'three/webgpu';
import { WebGPUData } from '../../utils/webgpu-data';
import { vertexBuffers } from '../../utils/loader';

import { DepthMap } from '../depth-pass';
import { ComponentsMap, Entity, Scene } from '../../scene/scene-types';
import { SceneBuffers } from '../../scene/scene-buffers';
import { ConfigBuffers } from '../../config/config-buffers';
import { OccluderBuffers } from '../../config/occluder-buffer';
import { precomputeOccRaw, precomputeOccVertexRaw, shadowMapFragment, shadowMapVertex } from '../imported-shaders';

function createEntityBindGroups(
    gpu: WebGPUData,
    pipeline: GPURenderPipeline,
    dynamicObjectBuffer: GPUBuffer,
    cameraBuffer: GPUBuffer,
    scene: Scene,
    entity: Entity
) {
    const entityBindGroups = (objectBuffer: GPUBuffer) => {
        const bindGroups = [];
        const components = ComponentsMap.get(entity);
        if (!components) {
            throw (
                'Entity ' +
                entity.id +
                ' does not have a render component present.'
            );
        }
        for (const c of components) {
            const bindGroup = gpu.device.createBindGroup({
                label: 'shadowpass-entityBindGroups' + entity.id + "-" + c.RenderComponent.offset,
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    {
                        binding: 0,
                        resource: cameraBuffer,
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: objectBuffer,
                            offset: c.RenderComponent.offset * 256,
                            size: 144,
                        }
                    }
                ],
            });
            bindGroups.push(bindGroup);
        }

        return bindGroups;
    };

    const preoccludedEntityBindGroups = entityBindGroups(
        dynamicObjectBuffer
    );

    return preoccludedEntityBindGroups;
}

function createLightBindGroups(
    gpu: WebGPUData,
    pipeline: GPURenderPipeline,
    configBuffers: ConfigBuffers,
    occluderBuffers: OccluderBuffers,
    entity: Entity
) {
    const idToPrecomputeBuffer = gpu.device.createBuffer({
        size: (4) * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: "cameraBuffer-shadowPass"
    });
    const infoToBuffer =  new Float32Array(4);
    const info = occluderBuffers.occluderInfos.get(entity);
    if(!info) {
        console.error("NO INFO!");
        infoToBuffer.set([0, 0, 0, 1.0], 0);
    } else {
        infoToBuffer.set([info?.modelMatrixOffset, info?.numberOfSpheres, info?.offset, 1.0], 0);
    }

    gpu.device.queue.writeBuffer(idToPrecomputeBuffer, 0, infoToBuffer);

    const lightBindGroups = gpu.device.createBindGroup({
        label: 'depthpass-lightBindGroups',
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: configBuffers.configBuffer,
                    offset: 0,
                    size: configBuffers.configBufferSize,
                },
            },
            {
                binding: 1,
                resource: { 
                    buffer: occluderBuffers.buffer
                },
            },
            {
                binding: 2,
                resource: { buffer: occluderBuffers.modelMatrixBuffer },
            },
            {
                binding: 3,
                resource: { buffer: idToPrecomputeBuffer },
            },
        ],
    });

    return lightBindGroups;
}

export async function PrecomputeOccluders(
    gpu: WebGPUData,
    encoder: GPUCommandEncoder,
    scene: Scene,
    buffers: SceneBuffers,
    configBuffers: ConfigBuffers,
    occluderBuffers: OccluderBuffers,
    entity: Entity
): Promise<GPUTexture> {

    const objTexture = gpu.device.createTexture({
        size: [512, 512, 1],
        dimension: "3d",
        format: "rgba16float",
        usage:
            GPUTextureUsage.RENDER_ATTACHMENT |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST,
    });

    const pipeline = gpu.device.createRenderPipeline({
        label: "OccBake",
        vertex: {
            module: gpu.device.createShaderModule({
                code: precomputeOccVertexRaw,
            }),
            entryPoint: "main",
            buffers: vertexBuffers,
        },
        fragment: {
            module: gpu.device.createShaderModule({
                code: precomputeOccRaw,
            }),
            entryPoint: "main",
            targets: [
                {
                    format: objTexture.format,
                },
            ],
        },
        primitive: {
            topology: "triangle-list",
            cullMode: "none",
        },
        layout: "auto",
        depthStencil: undefined,
    });

    const entityBindGroups = createEntityBindGroups(
        gpu,
        pipeline,
        buffers.dynamicObjectBuffer,
        buffers.cameraBuffer,
        scene,
        entity
    );

    const lightBindGroup = createLightBindGroups(
        gpu,
        pipeline,
        configBuffers,
        occluderBuffers,
        entity
    );

    const pass = encoder.beginRenderPass({
        colorAttachments: [
            {
                view: objTexture.createView({
                    dimension: "2d-array",
                    baseArrayLayer: 0,
                    arrayLayerCount: 1,
                }),
                loadOp: "clear",
                storeOp: "store",
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
            },
        ],
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(1, lightBindGroup);

    const components = ComponentsMap.get(entity);
    if (!components) {
        pass.end();
        return objTexture;
    }

    let offset = 0;
    for (const c of components) {
        const mesh = c.RenderComponent.mesh;
        pass.setBindGroup(0, entityBindGroups[offset]);
        pass.setVertexBuffer(0, mesh.vertexBuffer);
        if (mesh.indexBuffer) {
            pass.setIndexBuffer(mesh.indexBuffer, "uint16");
            pass.drawIndexed(mesh.indexCount);
        } else {
            pass.draw(mesh.vertexCount);
        }

        offset++;
    }

    pass.end();

    return objTexture;
}