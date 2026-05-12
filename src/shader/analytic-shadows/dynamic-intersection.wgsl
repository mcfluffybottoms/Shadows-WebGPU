fn sphereIntersectsAABB(box: AABB, center: vec3f, radius: f32, dir: vec3f) -> bool {
    let vDelta = max(vec3f(0.0), abs(box.c - center) - box.e);
	let fDistSq = dot(vDelta, vDelta);
	return fDistSq <= radius * radius;
}

fn zTest(
    sphereCenter: vec3f,
    sphereRadius: f32,
    tileMinDepth: f32,
    tileMaxDepth: f32
) -> bool {
    return (sphereCenter.z - sphereRadius <= tileMaxDepth && sphereCenter.z + sphereRadius >= tileMinDepth);
}

fn reconstructViewPos(
    ndc: vec3f,
    invProj: mat4x4<f32>
) -> vec3f {
    var p = invProj * vec4f(ndc.xy, ndc.z * 2.0 - 1.0, 1.0);
    p /= p.w;

    return p.xyz;
}

// TODO: PARALLEL
fn getMaxMinDepth(pxMin: vec2f, pxMax: vec2f) -> vec2f {
    var minD = 1e30;
    var maxD = -1e30;

    for (var y = pxMin.y; y < pxMax.y; y = y + 1.0) {
        for (var x = pxMin.x; x < pxMax.x; x = x + 1.0) {

            let uv = (vec2f(f32(x), f32(y)) + 0.5) / vec2f(SCREEN);
            
            let d = textureSampleLevel(depthTex, depthSampler, uv, 0);

            minD = min(minD , d * 0.5 + 0.5);
            maxD = max(maxD, d * 0.5 + 0.5);
        }
    }

    return vec2f(minD, maxD);
}

struct AABB {
    c: vec3f,
    e: vec3f,
}

fn getTileAABB(
    ndcMinX: f32, ndcMaxX: f32,
    ndcMinY: f32, ndcMaxY: f32,
    nearZ: f32, farZ: f32,
    invProj: mat4x4<f32>,
    config: Config
) -> AABB {
    let p0 = reconstructViewPos(vec3f(ndcMinX, ndcMinY, nearZ), invProj);
    let p1 = reconstructViewPos(vec3f(ndcMaxX, ndcMinY, nearZ), invProj);
    let p2 = reconstructViewPos(vec3f(ndcMaxX, ndcMaxY, nearZ), invProj);
    let p3 = reconstructViewPos(vec3f(ndcMinX, ndcMaxY, nearZ), invProj);

    let p4 = reconstructViewPos(vec3f(ndcMinX, ndcMinY, farZ), invProj);
    let p5 = reconstructViewPos(vec3f(ndcMaxX, ndcMinY, farZ), invProj);
    let p6 = reconstructViewPos(vec3f(ndcMaxX, ndcMaxY, farZ), invProj);
    let p7 = reconstructViewPos(vec3f(ndcMinX, ndcMaxY, farZ), invProj);

    var mn = p0;
    var mx = p0;

    let pts = array<vec3f, 8>(p0,p1,p2,p3,p4,p5,p6,p7);

    for (var i = 1u; i < 8u; i++) {
        mn = min(mn, pts[i]);
        mx = max(mx, pts[i]);
    }

    var aabb = AABB(vec3f(0.0), vec3f(0.0));
    aabb.c = (mn + mx) * 0.5;
    aabb.e = abs(mx - aabb.c);

    return aabb;
}

@group(0) @binding(0) var<storage, read> occluders: array<SphereOccluder>;
@group(0) @binding(1) var<storage, read> occludersMatrix: array<SphereOptions>;
@group(0) @binding(2) var<storage, read_write> occlusionResults: array<OcclusionOutput>;
@group(0) @binding(3) var<storage, read> occludersEntityIds: array<vec2u>;

@group(1) @binding(0) var<uniform> lightOptions: LightOptionsUniforms;
@group(1) @binding(1) var<uniform> camera: CameraUniforms;
@group(1) @binding(2) var<uniform> config: Config;
@group(1) @binding(3) var depthTex: texture_depth_2d;
@group(1) @binding(4) var depthSampler: sampler;
/*
    One work group getting one tile
    Get all occluders in parallel
*/
const WG_SIZE: u32 = WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y;
var<workgroup> numOccluders: atomic<u32>;
var<workgroup> sharedMin: array<f32, WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y>;
var<workgroup> sharedMax: array<f32, WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y>;
var<workgroup> sharedOccluders: array<u32, NUM_POSSIBLE_OCCLUDERS>;
@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>,
        @builtin(local_invocation_id) localId: vec3<u32>,
        @builtin(workgroup_id) workgroupId: vec3<u32>) {
    // thread data
    let threadIndex = localId.y * WORKGROUP_SIZE_X + localId.x;
    let totalThreads = TOTAL_THREADS;
    
    // light direction
    var lightDir = normalize((camera.viewMatrix * vec4f(-1 * lightOptions.dir.xyz, 0.0)).xyz);
    lightDir.z = -lightDir.z;

    // get tile data
    let tileY = workgroupId.y;
    let tileX = workgroupId.x;

    let stepX = f32(SCREEN.x) / f32(config.tilesX);
    let stepY = f32(SCREEN.y) / f32(config.tilesY);

    let pxMinX = f32(tileX) * stepX;
    let pxMaxX = f32(tileX + 1u) * stepX;

    let pxMinY = f32(tileY) * stepY;
    let pxMaxY = f32(tileY + 1u) * stepY;

    var ndcMinX = -pxMinX / f32(SCREEN.x) * 2.0 + 1.0;
    var ndcMaxX = -pxMaxX / f32(SCREEN.x) * 2.0 + 1.0;
    var ndcMinY = pxMinY / f32(SCREEN.y) * 2.0 - 1.0;
    var ndcMaxY = pxMaxY / f32(SCREEN.y) * 2.0 - 1.0;

    // ndcMinX = -pxMinX / f32(SCREEN.x);
    // ndcMaxX = -pxMaxX / f32(SCREEN.x);
    // ndcMinY = pxMinY / f32(SCREEN.y);
    // ndcMaxY = pxMaxY / f32(SCREEN.y) ;


    // find depths for each tile 
    let depthSize = vec2f(textureDimensions(depthTex));
    let depthStepX = stepX * (depthSize.x / f32(SCREEN.x));
    let depthStepY = stepY * (depthSize.y / f32(SCREEN.y));
    let depthMinX = f32(tileX) * depthStepX;
    let depthMaxX = f32(tileX + 1u) * depthStepX;
    let depthMinY = f32(tileY) * depthStepY;
    let depthMaxY = f32(tileY + 1u) * depthStepY;

    var minD = 1e30;
    var maxD = -1e30;

    let startX = depthMinX + f32(localId.x);
    let startY = depthMinY + f32(localId.y);
    for (var y = startY; y < depthMaxY; y = y + f32(WORKGROUP_SIZE_Y)) {
        for (var x = startX; x < depthMaxX; x = x + f32(WORKGROUP_SIZE_X)) {
            let uv = (vec2f(x, y) + 0.5) / depthSize;
            let d = textureSampleLevel(depthTex, depthSampler, uv, 0);
            
            minD = min(minD, d);
            maxD = max(maxD, d);
        }
    }

    sharedMin[threadIndex] = minD;
    sharedMax[threadIndex] = maxD;
    workgroupBarrier();

    // parallel reduction to find min/max for the tile
    var offset = WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y / 2u;
    while (offset > 0u) {
        if (threadIndex < offset) {
            sharedMin[threadIndex] = min(sharedMin[threadIndex], sharedMin[threadIndex + offset]);
            sharedMax[threadIndex] = max(sharedMax[threadIndex], sharedMax[threadIndex + offset]);
        }
        workgroupBarrier();
        offset = offset / 2u;
    }

    minD = sharedMin[0];
    maxD = sharedMax[0];

    // get aabb
    let aabb = getTileAABB(
        ndcMinX, ndcMaxX, 
        ndcMinY, ndcMaxY, 
        0.0, 1.0, 
        camera.invProjMatrix, 
        config
    );

    if (localId.x == 0u && localId.y == 0u) {
        atomicStore(&numOccluders, 0u);
    }
    workgroupBarrier();

    // get occluders for each tile
    for (var i = threadIndex; i < arrayLength(&occluders); i += totalThreads) {
        let eid = occludersEntityIds[i][0];
        let modelMatrix = occludersMatrix[eid].modelMatrix;
        let scale = occludersMatrix[eid].scale;
        var centerPos = camera.viewMatrix * modelMatrix * vec4f(occluders[i].center.xyz, 1.0);
        let worldRadius = occluders[i].center.w * scale[0];
        //sphereProjectedAlongLightIntersectsTile(frustumCorners, centerPos1.xyz, occluders[i].center.w * 0.01, lightDir)

        
        if (sphereIntersectsAABB(aabb, centerPos.xyz, worldRadius * 25.0, lightDir)) {
                       
            
            let index = atomicAdd(&numOccluders, 1u);
            sharedOccluders[index] = i;
        }
    }
    workgroupBarrier();

    // get answer
    let tileId = tileY * config.tilesX + tileX;
    let finalCount = atomicLoad(&numOccluders);

    if (threadIndex == 0u) {
        var c = f32(min(finalCount, NUM_POSSIBLE_OCCLUDERS));
        occlusionResults[tileId].count = vec4f(vec3f(c), 1.0);
    }

    for (var i = threadIndex; i < min(finalCount, NUM_POSSIBLE_OCCLUDERS); i += totalThreads) {
        occlusionResults[tileId].indices[i] = sharedOccluders[i];
    }
}