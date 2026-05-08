import * as THREE from "three/webgpu";
import { WebGPUData } from "../utils/webgpu-data";
import { vertexBuffers } from "../utils/loader";

import occludersShadowPass from '../shader/analytic-shadows/dynamic-intersection.wgsl?raw';
import { ComponentsMap, Entity, Scene } from "../scene/scene-types";
import { ConfigBuffers } from "../config/config-buffers";
import { importShaderCode } from "../utils/import-shader-code";
import { SceneBuffers } from "../scene/scene-buffers";
import { OccluderBuffers } from "../config/occluder-buffer";
import { UI } from "../UI/UI-flags-types";

const analyticShadowsPass = await importShaderCode(occludersShadowPass);

// grid size
// cone angle
// ambient component - cosine weighted percentage hemisphere occluded
// directional component - trace to point by direction, get  + intercestions with sphere
// precoimpute using monte carlo for directional component -store in a texture


export interface AnalyticPassResources {
    pipeline: GPUComputePipeline;
    lightBindGroup: GPUBindGroup;
    entityBindGroups: GPUBindGroup[];
};


/*
@group(0) @binding(0) var<storage, read> occluders: array<SphereOccluder>;
@group(0) @binding(1) var<storage, read_write> occlusionResults: array<OcclusionOutput>;
@group(1) @binding(0) var<uniform> lightOptions: LightOptionsUniforms;
*/

function createEntityBindGroups(
    gpu: WebGPUData,
    pipeline: GPUComputePipeline,
    objectBuffer: GPUBuffer,
    occluderBuffers: OccluderBuffers,
    scene: Scene
)  {
    const bindGroups = [];
    let offset = 0;
    for (const e of scene.dynamicEntities) {
        const bindGroup = gpu.device.createBindGroup({
            label: "analyticPass-entityBindGroups" + e.id,
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: occluderBuffers.buffer },
                },
                {
                    binding: 1,
                    resource: { buffer: occluderBuffers.outputBuffer },
                },
            ]
        })
        offset++;
        bindGroups.push(bindGroup);
    }

    return bindGroups;
}

function createLightBindGroups(
    gpu: WebGPUData,
    pipeline: GPUComputePipeline,
    lightBufferOptions: GPUBuffer,
    cameraBuffer: GPUBuffer,
    configBuffer: GPUBuffer
) {
    const lightBindGroups = gpu.device.createBindGroup({
        label: "analyticPass-lightBindGroups",
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: { buffer: lightBufferOptions }
            },
            {
                binding: 1,
                resource: { buffer: cameraBuffer }
            },
            {
                binding: 2,
                resource: { buffer: configBuffer }
            }
        ]
    });

    return lightBindGroups;
}

export async function initAPass(
    gpu: WebGPUData,
    scene: Scene,
    buffers: SceneBuffers,
    occluderBuffers: OccluderBuffers,
    camera: GPUBuffer,
    configBuffer: GPUBuffer
): Promise<AnalyticPassResources> {

    const pipeline = gpu.device.createComputePipeline({
        label: "analyticShadowsPass",
        layout: "auto",
        compute: {
            module: gpu.device.createShaderModule({
            code: analyticShadowsPass,
            label: "analyticShadowsPassShader",
            }),
            entryPoint: "main",
        },
    });

    const lightBindGroup = createLightBindGroups(gpu, pipeline, buffers.lightBufferOptions, camera, configBuffer);
    const entityBindGroups = createEntityBindGroups(gpu, pipeline, buffers.staticObjectBuffer,
        occluderBuffers,
        scene
    );

    return { pipeline, lightBindGroup, entityBindGroups };
}

export async function aPass(
    resources: AnalyticPassResources,
    encoder: GPUCommandEncoder,
    scene: Scene
) {
    const { pipeline, lightBindGroup, entityBindGroups } = resources;

    let entities: Entity[];
    entities = scene.staticEntities;

    // begin compute pass
    const computePass = encoder.beginComputePass({
        label: "OcclusionComputePass",
    });

    const lightGroup = lightBindGroup;

    computePass.setPipeline(pipeline);
    computePass.setBindGroup(1, lightGroup);

    const WORKGROUP_X = UI.tilesX;
    const WORKGROUP_Y = UI.tilesY;

    for (let j = 0; j < 1; ++j) {
        const group = entityBindGroups[j];
        computePass.setBindGroup(0, group);
        computePass.dispatchWorkgroups(WORKGROUP_X, WORKGROUP_Y, 1);
    }

    computePass.end();
}