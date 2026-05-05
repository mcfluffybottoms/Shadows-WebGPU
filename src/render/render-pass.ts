import * as THREE from "three/webgpu";
import { WebGPUData } from "../utils/webgpu-data";
import { vertexBuffers } from "../utils/loader";

import shadowMapVertexRaw from '../shader/shadow-map/shadowmap-vertex.wgsl?raw';
import shadowMapFragmentRaw from '../shader/shadow-map/shadowmap-fragment.wgsl?raw';
import { DepthMap } from "./depth-pass";
import { ComponentsMap, Entity, Scene } from "../scene/scene-types";
import { SceneBuffers } from "../scene/scene-buffers";
import { ConfigBuffers } from "../config/config-buffers";
import { importShaderCode } from "../utils/import-shader-code";

const MAX_CASCADES = 8;

const shadowMapVertex = importShaderCode(shadowMapVertexRaw);
const shadowMapFragment = importShaderCode(shadowMapFragmentRaw);

export interface RenderPassResources {
    pipeline: GPURenderPipeline;
    lightBindGroups: GPUBindGroup;
    staticEntityBindGroups: GPUBindGroup[];
    dynamicEntityBindGroups: GPUBindGroup[];
    // textures 
    sceneDepthTexture: GPUTexture;
};


function createEntityBindGroups(
    gpu: WebGPUData,
    pipeline: GPURenderPipeline,
    staticObjectBuffer: GPUBuffer,
    dynamicObjectBuffer: GPUBuffer,
    cameraBuffer: GPUBuffer,
    staticDepthMap: DepthMap,
    dynamicDepthMap: DepthMap,
    scene: Scene
) {
    const entityBindGroups = (entities: Entity[], objectBuffer: GPUBuffer) => {

        return entities.map((e, i) => {
                const entity_rc = ComponentsMap.get(e)?.RenderComponent;
                if (!entity_rc) {
                    throw "Entity " + e.id + " does not have a render component present.";
                }
                return gpu.device.createBindGroup({
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
                                size: 144,
                            }
                        },
                        {
                            binding: 2,
                            resource: staticDepthMap.depthTexture.createView({
                                dimension: '2d-array',
                                baseArrayLayer: 0,
                                arrayLayerCount: staticDepthMap.numOfTextures
                            })
                        },
                        {
                            binding: 3,
                            resource: dynamicDepthMap.depthTexture.createView({
                                dimension: '2d-array',
                                baseArrayLayer: 0,
                                arrayLayerCount: dynamicDepthMap.numOfTextures
                            })
                        },
                        {
                            binding: 4,
                            resource: gpu.device.createSampler({
                                compare: 'less'
                            })
                        },
                        {
                            binding: 5,
                            resource: entity_rc.mesh.texture?.createView()
                        },
                        {
                            binding: 6,
                            resource: gpu.device.createSampler({
                                addressModeU: 'repeat',
                                addressModeV: 'repeat',
                                magFilter: 'linear',
                                minFilter: 'linear',
                                mipmapFilter: 'linear',
                            })
                        }
                    ]
                })
            }
        );
    }

    const staticEntityBindGroups = entityBindGroups(scene.staticEntities, staticObjectBuffer);
    const dynamicEntityBindGroups = entityBindGroups(scene.dynamicEntities, dynamicObjectBuffer);

    return { staticEntityBindGroups, dynamicEntityBindGroups };
}

function createLightBindGroups(
    gpu: WebGPUData,
    pipeline: GPURenderPipeline,
    snatchedLightBuffer: GPUBuffer,
    lightBufferOptions: GPUBuffer,
    configBuffers: ConfigBuffers,
) {
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
                    buffer: configBuffers.configBuffer,
                    offset: 0,
                    size: configBuffers.configBufferSize,
                }
            }
        ]
    });

    return lightBindGroups;
}

function createSceneDepthTexture(
    gpu: WebGPUData,
) {
    const depthTexture = gpu.device.createTexture({
        size: [gpu.canvas.width, gpu.canvas.height, 1],
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        format: 'depth24plus-stencil8',
    });

    return depthTexture;
}

export async function initRenderPass(
    gpu: WebGPUData,
    scene: Scene,
    staticDepthmap: DepthMap,
    dynamicDepthmap: DepthMap,
    buffers: SceneBuffers,
    configBuffers: ConfigBuffers
): Promise<RenderPassResources> {
    const { cameraBuffer, snatchedLightBuffer, lightBufferOptions, staticObjectBuffer, dynamicObjectBuffer } = buffers;

    const pipeline = gpu.device.createRenderPipeline({
        label: "ShadowPass",
        vertex: {
            module: gpu.device.createShaderModule({ code: shadowMapVertex, label: "shadowMapVertex" }),
            entryPoint: 'main',
            buffers: vertexBuffers
        },
        fragment: {
            module: gpu.device.createShaderModule({ code: shadowMapFragment, label: "shadowMapFragment" }),
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

    const lightBindGroups = createLightBindGroups(gpu, pipeline, snatchedLightBuffer, lightBufferOptions, configBuffers);
    const { staticEntityBindGroups, dynamicEntityBindGroups } = createEntityBindGroups(gpu, pipeline, staticObjectBuffer, dynamicObjectBuffer, cameraBuffer, staticDepthmap, dynamicDepthmap, scene);
    const sceneDepthTexture = createSceneDepthTexture(gpu);

    return {
        pipeline, lightBindGroups, staticEntityBindGroups, dynamicEntityBindGroups, sceneDepthTexture
    }
}

export async function RenderPass(
    resources: RenderPassResources,
    gpu: WebGPUData,
    encoder: GPUCommandEncoder,
    scene: Scene
) {
    const { staticEntities, dynamicEntities } = scene;
    const { pipeline, lightBindGroups, staticEntityBindGroups, dynamicEntityBindGroups, sceneDepthTexture } = resources;

    const renderPass = encoder.beginRenderPass({
        depthStencilAttachment: {
            view: sceneDepthTexture.createView(
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

    const processEntities = (entities: Entity[], entityBindGroups: GPUBindGroup[]) => {
        for (let j = 0; j < entities.length; ++j) {
            const entity_rc = ComponentsMap.get(entities[j])?.RenderComponent;
            if (!entity_rc) {
                console.warn("Entity " + entities[j].id + " does not have a render component present.");
                continue;
            }
            const { mesh } = entity_rc;
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
    }

    processEntities(staticEntities, staticEntityBindGroups);
    processEntities(dynamicEntities, dynamicEntityBindGroups);

    renderPass.end();
}

// ---- function to reinit only on certain changes ---- //
/*
    light layout changed
    numOfCascades changed
*/
export function onRenderPassLightChange(
    gpu: WebGPUData,
    resources: RenderPassResources,
    buffers: SceneBuffers,
    configBuffers: ConfigBuffers,
) {
    const { snatchedLightBuffer, lightBufferOptions } = buffers;
    resources.lightBindGroups = createLightBindGroups(gpu, resources.pipeline, snatchedLightBuffer, lightBufferOptions, configBuffers);
}
/*
    numOfCascades changed
    depth map changed
*/
export function onRenderPassDepthMapChange(
    gpu: WebGPUData,
    resources: RenderPassResources,
    scene: Scene,
    staticDepthMap: DepthMap,
    dynamicDepthMap: DepthMap,
    buffers: SceneBuffers
) {
    const { cameraBuffer, staticObjectBuffer, dynamicObjectBuffer } = buffers;
    const { staticEntityBindGroups, dynamicEntityBindGroups } = createEntityBindGroups(gpu, resources.pipeline, staticObjectBuffer, dynamicObjectBuffer, cameraBuffer, staticDepthMap, dynamicDepthMap, scene);
    resources.staticEntityBindGroups = staticEntityBindGroups;
    resources.dynamicEntityBindGroups = dynamicEntityBindGroups;
}
/*
    number of entitites changed
*/
export function onRenderPassSceneChange(
    gpu: WebGPUData,
    staticDepthMap: DepthMap,
    dynamicDepthMap: DepthMap,
    resources: RenderPassResources,
    scene: Scene,
    buffers: SceneBuffers
) {
    const { cameraBuffer, staticObjectBuffer, dynamicObjectBuffer } = buffers;
    const { staticEntityBindGroups, dynamicEntityBindGroups } = createEntityBindGroups(gpu, resources.pipeline, staticObjectBuffer, dynamicObjectBuffer, cameraBuffer, staticDepthMap, dynamicDepthMap, scene);
    resources.staticEntityBindGroups = staticEntityBindGroups;
    resources.dynamicEntityBindGroups = dynamicEntityBindGroups;
}


