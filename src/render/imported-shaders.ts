import { importShaderCode } from "../utils/import-shader-code";

import occludersShadowPass from '../shader/analytic-shadows/dynamic-intersection.wgsl?raw';
export const analyticShadowsPass = await importShaderCode(occludersShadowPass);

import debugDepthVertexRaw from '../shader/depth-map/debug-depth-map.wgsl?raw';
import debugDepthFragmentRaw from '../shader/depth-map/debug-depth-map-frag.wgsl?raw';
export const debugDepthVertex = importShaderCode(debugDepthVertexRaw);
export const debugDepthFragment = importShaderCode(debugDepthFragmentRaw);

import shadowMapVertexRaw from '../shader/shadow-map/shadowmap-vertex.wgsl?raw';
import shadowMapFragmentRaw from '../shader/shadow-map/shadowmap-fragment.wgsl?raw';
export const shadowMapVertex = importShaderCode(shadowMapVertexRaw);
export const shadowMapFragment = importShaderCode(shadowMapFragmentRaw);

import depthMapVertexRaw from '../shader/depth-map/depthmap.wgsl?raw';
export const depthMapVertex = await importShaderCode(depthMapVertexRaw);

import precomputeOccVertex from '../shader/precomputed-occluded-direction/precomputed-occluded-direction-vertex.wgsl?raw';
import precomputeOcc from '../shader/precomputed-occluded-direction/precomputed-occluded-direction.wgsl?raw';
export const precomputeOccVertexRaw = await importShaderCode(depthMapVertexRaw);
export const precomputeOccRaw = await importShaderCode(depthMapVertexRaw);