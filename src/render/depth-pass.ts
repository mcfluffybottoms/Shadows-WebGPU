import * as THREE from "three/webgpu";
import { WebGPUData } from "../utils/webgpu-data";
import { vertexBuffers } from "../utils/loader";

import depthMapVertex from '../shader/shadow-map/depthmap.wgsl?raw';
import { ComponentsMap, Scene } from "../scene/scene-types";
import { ConfigBuffers } from "../config/config-buffers";

export type DepthMap = {
    depthTexture: GPUTexture,
    depthTextureSize: number,
    numOfTextures: number
};

export function createDepthMap(
    gpu: WebGPUData,
    depthTextureSize: number,
    numOfTextures: number
): DepthMap {
    const depthTexture = gpu.device.createTexture({
        size: [depthTextureSize, depthTextureSize, numOfTextures],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float',
    });
    return { depthTextureSize, depthTexture, numOfTextures };
}

// keep depth map here
export interface DepthPassResources {
    pipeline: GPURenderPipeline;
    lightBindGroups: GPUBindGroup[];
    entityBindGroups: GPUBindGroup[];
    depthMap: DepthMap
};

function createEntityBindGroups(
    gpu: WebGPUData,
    pipeline: GPURenderPipeline,
    objectBuffer: GPUBuffer,
    configBuffers: ConfigBuffers,
    scene: Scene) {
    const entityBindGroups = scene.entities.map((_, i) =>
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
                        buffer: configBuffers.configBuffer,
                        offset: 0,
                        size: configBuffers.configBufferSize,
                    }
                }
            ]
        })
    );

    return entityBindGroups;
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
    objectBuffer: GPUBuffer,
    configBuffers: ConfigBuffers,
    depthPassSize: number,
    numOfCascades: number
): Promise<DepthPassResources> {
    const depthMap = createDepthMap(gpu, depthPassSize, numOfCascades);
    const pipeline = gpu.device.createRenderPipeline({
        label: "DepthPass",
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
        primitive: {
            topology: 'triangle-list',
            cullMode: 'front',
            frontFace: 'cw'
        },
        layout: "auto",
    });

    const lightBindGroups = createLightBindGroups(gpu, pipeline, cameraBuffer, numOfCascades);
    const entityBindGroups = createEntityBindGroups(gpu, pipeline, objectBuffer, configBuffers, scene);

    return { pipeline, lightBindGroups, entityBindGroups, depthMap };
}

export async function depthPass(
    resources: DepthPassResources,
    encoder: GPUCommandEncoder,
    scene: Scene,
    numOfCascades: number
) {
    // get uniform values for depth map render pipeline
    const { pipeline, lightBindGroups, entityBindGroups, depthMap } = resources;
    const { entities } = scene;

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

        //depthPass.setViewport(0, 0, d.depthTextureSize, d.depthTextureSize, 0, 1);
        depthPass.setPipeline(pipeline);
        depthPass.setBindGroup(1, lightGroup);
        for (let j = 0; j < entities.length; ++j) {
            const entity_rc = ComponentsMap.get(entities[j])?.RenderComponent;
            if (!entity_rc) {
                console.warn("Entity " + entities[j].id + " does not have a render component present.");
                continue;
            }
            const { mesh } = entity_rc;
            const group = entityBindGroups[j];
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
    objectBuffer: GPUBuffer,
    configBuffers: ConfigBuffers,
) {
    resources.entityBindGroups = createEntityBindGroups(gpu, resources.pipeline, objectBuffer, configBuffers, scene);
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
    resources.depthMap = createDepthMap(gpu, depthPassSize, numOfCascades);
}