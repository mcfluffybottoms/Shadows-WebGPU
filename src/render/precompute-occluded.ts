import * as THREE from 'three/webgpu';
import { WebGPUData } from '../utils/webgpu-data';
import { vertexBuffers } from '../utils/loader';

import { DepthMap } from './depth-pass';
import { ComponentsMap, Entity, Scene } from '../scene/scene-types';
import { SceneBuffers } from '../scene/scene-buffers';
import { ConfigBuffers } from '../config/config-buffers';
import { OccluderBuffers } from '../config/occluder-buffer';
import { precomputeOccRaw, precomputeOccVertexRaw, shadowMapFragment, shadowMapVertex } from './imported-shaders';

function createEntityBindGroups(
    gpu: WebGPUData,
    pipeline: GPURenderPipeline,
    staticObjectBuffer: GPUBuffer,
    dynamicObjectBuffer: GPUBuffer,
    cameraBuffer: GPUBuffer,
    scene: Scene
) {
    const entityBindGroups = (entities: Entity[], objectBuffer: GPUBuffer) => {
        const bindGroups = [];
        let offset = 0;
        for (const e of entities) {
            const components = ComponentsMap.get(e);
            if (!components) {
                throw (
                    'Entity ' +
                    e.id +
                    ' does not have a render component present.'
                );
            }
            for (const c of components) {
                const bindGroup = gpu.device.createBindGroup({
                    label: 'shadowpass-entityBindGroups' + e.id + "-" + offset,
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
                                offset: offset * 256,
                                size: 144,
                            }
                        }
                    ],
                });
                offset++;
                bindGroups.push(bindGroup);
            }
        }

        return bindGroups;
    };

    const staticEntityBindGroups = entityBindGroups(
        scene.staticEntities,
        staticObjectBuffer
    );
    const dynamicEntityBindGroups = entityBindGroups(
        scene.dynamicEntities,
        dynamicObjectBuffer
    );

    return { staticEntityBindGroups, dynamicEntityBindGroups };
}

function createLightBindGroups(
    gpu: WebGPUData,
    pipeline: GPURenderPipeline,
    configBuffers: ConfigBuffers,
    occluderBuffers: OccluderBuffers
) {
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
                resource: { buffer: occluderBuffers.buffer },
            },
            {
                binding: 2,
                resource: { buffer: occluderBuffers.modelMatrixBuffer },
            },
            {
                binding: 3,
                resource: { buffer: occluderBuffers.idBuffer },
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
        buffers.staticObjectBuffer,
        buffers.dynamicObjectBuffer,
        buffers.cameraBuffer,
        scene
    );

    const lightBindGroup = createLightBindGroups(
        gpu,
        pipeline,
        configBuffers,
        occluderBuffers
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

    const processEntities = (
        entities: Entity[],
        bindGroups: GPUBindGroup[]
    ) => {
        let offset = 0;

        for (const e of entities) {
            const components = ComponentsMap.get(e);
            if (!components) continue;

            for (const c of components) {
                if(e != entity) {
                    offset++;
                    continue;
                }
                const mesh = c.RenderComponent.mesh;

                pass.setBindGroup(0, bindGroups[offset]);

                pass.setVertexBuffer(0, mesh.vertexBuffer);

                if (mesh.indexBuffer) {
                    pass.setIndexBuffer(mesh.indexBuffer, "uint16");
                    pass.drawIndexed(mesh.indexCount);
                } else {
                    pass.draw(mesh.vertexCount);
                }

                offset++;
            }
        }
    };

    processEntities(scene.dynamicEntities, entityBindGroups.dynamicEntityBindGroups);

    pass.end();

    return objTexture;
}