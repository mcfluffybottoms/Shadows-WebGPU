import * as THREE from "three/webgpu";
import { WebGPUData } from "../utils/webgpu-data";
import { Scene } from "../scene/scene-types";
import { importShaderCode } from "../utils/import-shader-code";
import { SceneBuffers } from "../scene/scene-buffers";
import { OccluderBuffers } from "../config/occluder-buffer";
import { UI } from "../UI/UI-flags-types";
import { DepthMap } from "./depth-pass";
import { analyticShadowsPass } from "./imported-shaders";

export interface AnalyticPassResources {
    pipeline: GPUComputePipeline;
    lightBindGroup: GPUBindGroup;
    entityBindGroups: GPUBindGroup;
    depthMap: DepthMap;
};

function createEntityBindGroups(
    gpu: WebGPUData,
    pipeline: GPUComputePipeline,
    occluderBuffers: OccluderBuffers,
    scene: Scene
)  {
    return gpu.device.createBindGroup({
        label: "analyticPass-entityBindGroups",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: { buffer: occluderBuffers.buffer },
            },
            {
                binding: 1,
                resource: { buffer: occluderBuffers.modelMatrixBuffer },
            },
            {
                binding: 2,
                resource: { buffer: occluderBuffers.outputBuffer },
            },
            {
                binding: 3,
                resource: { buffer: occluderBuffers.idBuffer },
            },
        ]
    });
}

function createLightBindGroups(
    gpu: WebGPUData,
    pipeline: GPUComputePipeline,
    lightBufferOptions: GPUBuffer,
    cameraBuffer: GPUBuffer,
    configBuffer: GPUBuffer,
    depthMap: DepthMap
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
            },
            {
                binding: 3,
                resource: depthMap.depthTexture.createView()
            },
            {
                binding: 4,
                resource: gpu.device.createSampler({
                    addressModeU: 'repeat',
                    addressModeV: 'repeat',
                    magFilter: 'linear',
                    minFilter: 'linear',
                    mipmapFilter: 'linear',
                })
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
    configBuffer: GPUBuffer,
    depthMap: DepthMap
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

    const lightBindGroup = createLightBindGroups(gpu, pipeline, buffers.lightBufferOptions, camera, configBuffer, depthMap);
    const entityBindGroups = createEntityBindGroups(gpu, pipeline, occluderBuffers, scene);

    return { depthMap, pipeline, lightBindGroup, entityBindGroups };
}

export async function aPass(
    resources: AnalyticPassResources,
    encoder: GPUCommandEncoder,
    scene: Scene
) {
    const { pipeline, lightBindGroup, entityBindGroups } = resources;

    // begin compute pass
    const computePass = encoder.beginComputePass({
        label: "OcclusionComputePass",
    });

    const lightGroup = lightBindGroup;

    computePass.setPipeline(pipeline);
    computePass.setBindGroup(1, lightGroup);

    const WORKGROUP_X = UI.tilesX;
    const WORKGROUP_Y = UI.tilesY;

    computePass.setBindGroup(0, entityBindGroups);
    computePass.dispatchWorkgroups(WORKGROUP_X, WORKGROUP_Y, 1);

    computePass.end();
}