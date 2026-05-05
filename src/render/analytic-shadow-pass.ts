import * as THREE from "three/webgpu";
import { WebGPUData } from "../utils/webgpu-data";
import { vertexBuffers } from "../utils/loader";

import depthMapVertexRaw from '../shader/shadow-map/depthmap.wgsl?raw';
import { ComponentsMap, Entity, Scene } from "../scene/scene-types";
import { ConfigBuffers } from "../config/config-buffers";
import { importShaderCode } from "../utils/import-shader-code";

const analyticShadowsPass = await importShaderCode(depthMapVertexRaw);

export type AreaIntersectionMap = {
    texture: GPUTexture,
    textureWidth: number,
    textureHeight: number,
};

// grid size
// cone angle
// ambient component - cosine weighted percentage hemisphere occluded
// directional component - trace to point by direction, get  + intercestions with sphere
// precoimpute using monte carlo for directional component -store in a texture
/*
    Create a texture which stores the result of
    area intersection for directional component
*/
export function createPrecomputedAreaIntersection(
    gpu: WebGPUData,
    textureWidth: number,
    textureHeight: number
): AreaIntersectionMap {
    const texture = gpu.device.createTexture({
        size: [textureWidth, textureHeight],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float',
    });
    return { textureWidth, textureHeight, texture };
}

function ambientComponent(
    sphereRadius: number,
    distance: number
): number {
    return (sphereRadius / distance) * (sphereRadius / distance);
}

function dynamicComponent(
    direction: THREE.Vector3,
    distance: number
): number {
    return (sphereRadius / distance) * (sphereRadius / distance);
}


/*
    Ambient Aperture Lighting -- Chris Oat, Pedro V. Sander
*/
function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}
function saturate(x: number): number {
    return Math.max(0, Math.min(1, x));
}
function sphericalCapIntersectionApproxCPU(
    radius1: number,
    radius2: number,
    distance: number
): number {
    let area: number = 0;

    if(distance >= radius1 + radius2) {
        return area;
    }

    area = 6.283185308 - 6.283185308 * Math.cos(Math.min(radius1, radius2));

    if(distance > Math.max(radius1, radius2) - Math.min(radius1, radius2)) {
        const diff = Math.abs(radius1 - radius2);
        area *= smoothstep(0.0, 1.0, 1.0-saturate((diff - diff)/(radius1 + radius2 - diff)));
    }

    return area;
}

export interface AnalyticPassResources {
    pipeline: GPURenderPipeline;
    lightBindGroups: GPUBindGroup[];
    entityBindGroups: GPUBindGroup[];
    areaIntersectionMap: AreaIntersectionMap;
};

function createEntityBindGroups(
    gpu: WebGPUData,
    pipeline: GPURenderPipeline,
    objectBuffer: GPUBuffer,
    configBuffers: ConfigBuffers,
    scene: Scene
)  {
    const createEntityBindGroups = (entities: Entity[], objectBuffer: GPUBuffer) => {
        return entities.map((_, i) =>
            gpu.device.createBindGroup({
                label: "depthpass-entityBindGroups" + i,
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: objectBuffer,
                            offset: i * 256,
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
        );
    }

    const entityBindGroups = createEntityBindGroups(scene.staticEntities, objectBuffer);

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