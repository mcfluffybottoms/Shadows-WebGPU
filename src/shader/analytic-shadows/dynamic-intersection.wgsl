fn sphereIntersectsAABB(box: AABB, center: vec3f, radius: f32, dir: vec3f) -> bool {
    let closest = clamp(center, box.min, box.max);
    let d = abs(closest - center);
    return dot(d, d) <= radius * radius;
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
    var p = invProj * vec4f(ndc, 1.0);
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
            
            let d = textureSampleLevel(depthTex, depthSampler, uv, 0, 0);

            minD = min(minD, d);
            maxD = max(maxD, d);
        }
    }

    return vec2f(minD, maxD);
}

struct AABB {
    min: vec3f,
    max: vec3f,
}

fn getTileAABB(
    tileX: u32,
    tileY: u32,
    invProj: mat4x4<f32>,
    config: Config
) -> AABB {

    let stepX = f32(SCREEN.x) / f32(config.tilesX);
    let stepY = f32(SCREEN.y) / f32(config.tilesY);

    let pxMinX = f32(tileX) * stepX;
    let pxMaxX = f32(tileX + 1u) * stepX;

    let pxMinY = f32(tileY) * stepY;
    let pxMaxY = f32(tileY + 1u) * stepY;

    let ndcMinX = pxMinX / f32(SCREEN.x) * 2.0 - 1.0;
    let ndcMaxX = pxMaxX / f32(SCREEN.x) * 2.0 - 1.0;
    let ndcMinY = -pxMinY / f32(SCREEN.y) * 2.0 + 1.0;
    let ndcMaxY = -pxMaxY / f32(SCREEN.y) * 2.0 + 1.0;

    let d = getMaxMinDepth(vec2f(pxMinX, ndcMaxY), vec2f(pxMaxX, pxMaxY));

    let nearZ = 0.0;
    let farZ  = 1.0;

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

    return AABB(mn, mx);
}

@group(0) @binding(0) var<storage, read> occluders: array<SphereOccluder>;
@group(0) @binding(1) var<storage, read> occludersMatrix: array<SphereOptions>;
@group(0) @binding(2) var<storage, read_write> occlusionResults: array<OcclusionOutput>;
@group(0) @binding(3) var<storage, read> occludersEntityIds: array<vec2u>;

@group(1) @binding(0) var<uniform> lightOptions: LightOptionsUniforms;
@group(1) @binding(1) var<uniform> camera: CameraUniforms;
@group(1) @binding(2) var<uniform> config: Config;
@group(1) @binding(3) var depthTex: texture_depth_2d_array;
@group(1) @binding(4) var depthSampler: sampler;
/*
    One work group getting one tile
    Get all occluders in parallel
*/
const WG_SIZE: u32 = WORKGROUP_SIZE_X * 1;
var<workgroup> numOccluders: atomic<u32>;
var<workgroup> sharedOccluders: array<u32, NUM_POSSIBLE_OCCLUDERS>;
@compute @workgroup_size(WORKGROUP_SIZE_X, 1, 1)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>,
        @builtin(local_invocation_id) localId: vec3<u32>,
        @builtin(workgroup_id) workgroupId: vec3<u32>) {
    var lightDir = normalize((camera.viewMatrix * vec4f(-1 * lightOptions.dir.xyz, 0.0)).xyz);
    lightDir.z = -lightDir.z;

    let tileY = workgroupId.y;
    let tileX = workgroupId.x;

    let aabb = getTileAABB(tileX, tileY, camera.invProjMatrix, config);

    if (localId.x == 0u && localId.y == 0u) {
        atomicStore(&numOccluders, 0u);
    }
    workgroupBarrier();

    // GET OCCLUDERS FOR EACH TILE
    let threadIndex = localId.x;
    let totalThreads = TOTAL_THREADS;
    for (var i = threadIndex; i < arrayLength(&occluders); i += totalThreads) {
        let eid = occludersEntityIds[i][0];
        let modelMatrix = occludersMatrix[eid].modelMatrix;
        let scale = occludersMatrix[eid].scale;
        var centerPos = camera.viewMatrix * modelMatrix * vec4f(occluders[i].center.xyz, 1.0);
        let worldRadius = occluders[i].center.w * scale[0];
        //sphereProjectedAlongLightIntersectsTile(frustumCorners, centerPos1.xyz, occluders[i].center.w * 0.01, lightDir)
        if (sphereIntersectsAABB(aabb, centerPos.xyz, worldRadius * 4.0, lightDir)) {
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
        // occlusionResults[tileId].count = vec4f(vec3f(corners[0]), 1.0);
    }

    for (var i = threadIndex; i < min(finalCount, NUM_POSSIBLE_OCCLUDERS); i += totalThreads) {
        occlusionResults[tileId].indices[i] = sharedOccluders[i];
    }
}