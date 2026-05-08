import * as THREE from "three/webgpu";
import { WebGPUData } from "../utils/webgpu-data";
import { vertexBuffers } from "../utils/loader";

import depthMapVertexRaw from '../shader/shadow-map/depthmap.wgsl?raw';
import { ComponentsMap, Entity, Scene } from "../scene/scene-types";
import { ConfigBuffers } from "../config/config-buffers";
import { importShaderCode } from "../utils/import-shader-code";

const depthMapVertex = await importShaderCode(depthMapVertexRaw);

export type DepthMap = {
    depthTexture: GPUTexture,
    depthTextureWidth: number,
    depthTextureHeight: number,
    numOfTextures: number
};

export function createDepthMap(
    gpu: WebGPUData,
    depthTextureWidth: number,
    depthTextureHeight: number,
    numOfTextures: number
): DepthMap {
    const depthTexture = gpu.device.createTexture({
        size: [depthTextureWidth, depthTextureHeight, numOfTextures],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float',
    });
    return { depthTextureWidth, depthTextureHeight, depthTexture, numOfTextures };
}

// keep depth map here
export interface DepthPassResources {
    pipeline: GPURenderPipeline;
    lightBindGroups: GPUBindGroup[];
    staticEntityBindGroups: GPUBindGroup[];
    dynamicEntityBindGroups: GPUBindGroup[];
    dynamicDepthMap: DepthMap;
    staticDepthMap: DepthMap;
};

function createEntityBindGroups(
    gpu: WebGPUData,
    pipeline: GPURenderPipeline,
    staticObjectBuffer: GPUBuffer, 
    dynamicObjectBuffer: GPUBuffer,
    configBuffers: ConfigBuffers,
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
            for (const _ of components) {
                const bindGroup = gpu.device.createBindGroup({
                    label: "depthpass-entityBindGroups" + e.id + "-" + offset,
                    layout: pipeline.getBindGroupLayout(0),
                    entries: [
                        {
                            binding: 0,
                            resource: {
                                buffer: objectBuffer,
                                offset: offset * 256,
                                size: 144,
                            }
                        },
                        {
                            binding: 1,
                            resource: {
                                buffer: configBuffers.configBuffer,
                                offset: 0,
                                size: configBuffers.configBufferSize,
                            }
                        }
                    ]
                })
                offset++;
                bindGroups.push(bindGroup);
            }
        }

        return bindGroups;
    }

    const staticEntityBindGroups = entityBindGroups(scene.staticEntities, staticObjectBuffer);
    const dynamicEntityBindGroups = entityBindGroups(scene.dynamicEntities, dynamicObjectBuffer);

    return { staticEntityBindGroups, dynamicEntityBindGroups };
}

function createLightBindGroups(
    gpu: WebGPUData,
    pipeline: GPURenderPipeline,
    cameraBuffer: GPUBuffer,
    numOfCascades: number
) {
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

    return lightBindGroups;
}

export async function initDepthPass(
    gpu: WebGPUData,
    scene: Scene,
    cameraBuffer: GPUBuffer,
    staticObjectBuffer: GPUBuffer, 
    dynamicObjectBuffer: GPUBuffer,
    configBuffers: ConfigBuffers,
    depthPassSize: number,
    numOfCascades: number
): Promise<DepthPassResources> {
    const staticDepthMap = createDepthMap(gpu, depthPassSize, depthPassSize, numOfCascades);
    const dynamicDepthMap = createDepthMap(gpu, depthPassSize, depthPassSize, numOfCascades);

    const pipeline = gpu.device.createRenderPipeline({
        label: "DepthPass",
        vertex: {
            module: gpu.device.createShaderModule({ code: depthMapVertex, label: "depthMapVertex" }),
            entryPoint: 'main',
            buffers: vertexBuffers
        },
        depthStencil: {
            format: 'depth32float',
            depthWriteEnabled: true,
            depthCompare: "less",
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: 'front',
            frontFace: 'cw'
        },
        layout: "auto",
    });

    const lightBindGroups = createLightBindGroups(gpu, pipeline, cameraBuffer, numOfCascades);
    const { staticEntityBindGroups, dynamicEntityBindGroups } = createEntityBindGroups(gpu, pipeline, staticObjectBuffer, dynamicObjectBuffer, configBuffers, scene);

    return { pipeline, lightBindGroups, staticEntityBindGroups, dynamicEntityBindGroups, dynamicDepthMap, staticDepthMap };
}

export async function depthPass(
    resources: DepthPassResources,
    encoder: GPUCommandEncoder,
    scene: Scene,
    numOfCascades: number,
    isStatic: boolean
) {
    // get uniform values for depth map render pipeline
    const { pipeline, lightBindGroups } = resources;

    let entities: Entity[];
    let entityBindGroups: GPUBindGroup[];
    let depthMap: DepthMap;
    if (isStatic) {
        entities = scene.staticEntities;
        entityBindGroups = resources.staticEntityBindGroups;
        depthMap = resources.staticDepthMap;
    } else {
        entities = scene.dynamicEntities;
        entityBindGroups = resources.dynamicEntityBindGroups;
        depthMap = resources.dynamicDepthMap;
    }

    // begin render pass
    for (let i = 0; i < numOfCascades; ++i) {
        const depthPass = encoder.beginRenderPass({
            depthStencilAttachment: {
                view: depthMap.depthTexture.createView(
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

        depthPass.setPipeline(pipeline);
        depthPass.setBindGroup(1, lightGroup);
        let offset = 0;
        for (let j = 0; j < entities.length; ++j) {
            const components = ComponentsMap.get(entities[j]);
            if (!components) {
                console.warn("Entity " + entities[j].id + " does not have a render component present.");
                continue;
            }
            for (let i = 0; i < components.length; i++) {
                const mesh = components[i].RenderComponent.mesh;
                const group = entityBindGroups[offset];
                depthPass.setBindGroup(0, group);
                depthPass.setVertexBuffer(0, mesh.vertexBuffer);
                if (mesh.indexBuffer) {
                    depthPass.setIndexBuffer(mesh.indexBuffer, "uint16");
                    depthPass.drawIndexed(mesh.indexCount);
                } else {
                    depthPass.draw(mesh.vertexCount);
                }
                offset++;
            }
        }

        depthPass.end();
    }
}

// ---- function to reinit only on certain changes ---- //
/*
    cameraBuffer change in layout of buffer
    numOfCascades changed
    anythinmg connected with light layout
*/
export function onDepthMapLightChange(
    gpu: WebGPUData,
    resources: DepthPassResources,
    cameraBuffer: GPUBuffer,
    numOfCascades: number
) {
    resources.lightBindGroups = createLightBindGroups(gpu, resources.pipeline, cameraBuffer, numOfCascades);
}

/*
    object buffer size change
    number of entities changed
    config layout chagned - this will stay the same
*/
export function onDepthMapSceneChange(
    gpu: WebGPUData,
    resources: DepthPassResources,
    scene: Scene,
    staticObjectBuffer: GPUBuffer, 
    dynamicObjectBuffer: GPUBuffer,
    configBuffers: ConfigBuffers,
) {
    const { staticEntityBindGroups, dynamicEntityBindGroups } = createEntityBindGroups(gpu, resources.pipeline, staticObjectBuffer, dynamicObjectBuffer, configBuffers, scene);
    resources.staticEntityBindGroups = staticEntityBindGroups;
    resources.dynamicEntityBindGroups = dynamicEntityBindGroups;
}

/*
    object buffer size change
    number of entities changed
    config layout changed - this will stay the same
*/
export function onDepthMapChange(
    gpu: WebGPUData,
    resources: DepthPassResources,
    depthPassSize: number,
    numOfCascades: number,
) {
    resources.staticDepthMap = createDepthMap(gpu, depthPassSize, depthPassSize, numOfCascades);
    resources.dynamicDepthMap = createDepthMap(gpu, depthPassSize, depthPassSize, numOfCascades);
}