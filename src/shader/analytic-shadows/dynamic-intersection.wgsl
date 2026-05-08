fn PlaneIntersectCircle(
    plane: vec4f,
    sphereCenter: vec3f,
    sphereRadius: f32,
    lightDir: vec3f
) -> bool {
    let circleCenter = sphereCenter;
    let projectedRadius = sphereRadius;
    let dist = dot(plane.xyz, circleCenter) + plane.w;
    if (dist > projectedRadius) {
        return false;
    }
    return true;
}

fn getSphereOfIfluence(
    plane: vec4f,
    originalSphereCenter: vec3f,
    originallightDir: vec3f
) -> bool {
    let circleCenter = sphereCenter;
    let projectedRadius = sphereRadius;
    let dist = dot(plane.xyz, circleCenter) + plane.w;
    if (dist > projectedRadius) {
        return false;
    }
    return true;
}

fn intersect_cone_sphere_aligned(
    sphere_center: vec3<f32>,
    sphere_radius: f32,
    cone_angle_tan: f32
) -> bool {
    let cone_radius = max(cone_angle_tan * sphere_center.z, 0.0);
    let extends_past_cone_tip = sphere_center.z > -sphere_radius;
    let intersects_cone = length(sphere_center.xy) <= cone_radius + sphere_radius;
    return extends_past_cone_tip && intersects_cone;
}


fn sphereProjectedAlongLightIntersectsTile(
    tileFrustum: array<vec4f, 6>,  // frustum planes with inward normals
    sphereCenter: vec3f,     // in view space
    sphereRadius: f32,
    lightDir: vec3f
) -> bool {
    for(var i = 0 ; i < 6; i++) {
        if(!PlaneIntersectCircle(tileFrustum[i], sphereCenter, sphereRadius, lightDir)) {
            return false;
        }
    }
    return true;  // Intersects or is inside all planes
}

fn computePlaneFromPoints(p0: vec3<f32>, p1: vec3<f32>, p2: vec3<f32>, inwardPoint: vec3<f32>) -> vec4<f32> {
    let edge1 = p1 - p0;
    let edge2 = p2 - p0;
    
    var normal = normalize(cross(edge1, edge2));
    
    // Ensure normal points toward the inward point
    if (dot(normal, inwardPoint - p0) < 0.0) {
        normal = -normal;
    }
    
    let distance = dot(normal, p0);
    return vec4<f32>(normal, distance);
}

fn reconstructViewPos(
    ndc: vec3f,
    invProj: mat4x4<f32>
) -> vec3f {

    var p = invProj * vec4f(ndc, 1.0);
    p /= p.w;

    return p.xyz;
}

fn getTileFrustum(
    tileX: u32,
    tileY: u32,
    screenSize: vec2<u32>,
    invProj: mat4x4<f32>,
    config: Config
) -> array<vec4f, 6> {
    let STEP_X = f32(SCREEN.x) / f32(config.tilesX);
    let STEP_Y = f32(SCREEN.y) / f32(config.tilesY);

    let pxMinX = f32(tileX) * STEP_X;
    let pxMaxX = f32((tileX + 1u)) * STEP_X;

    let pxMinY = f32(tileY) * STEP_Y;
    let pxMaxY = f32((tileY + 1u)) * STEP_Y;

    // NDC
    let ndcMinX = 2 * pxMinX / f32(screenSize.x) - 1.0;
    let ndcMaxX = 2 * pxMaxX / f32(screenSize.x) - 1.0;
    let ndcMinY = (-pxMaxY / f32(screenSize.y)) * 2.0 + 1.0;
    let ndcMaxY = (-pxMinY / f32(screenSize.y)) * 2.0 + 1.0;
    let nearZ = 0.0;
    let farZ = STEP_X ;

    // reconstruct view-space corners
    let corners = array<vec3f, 8>(
        reconstructViewPos(vec3f(ndcMinX, ndcMinY, nearZ), invProj),
        reconstructViewPos(vec3f(ndcMaxX, ndcMinY, nearZ), invProj),
        reconstructViewPos(vec3f(ndcMaxX, ndcMaxY, nearZ), invProj),
        reconstructViewPos(vec3f(ndcMinX, ndcMaxY, nearZ), invProj),

        reconstructViewPos(vec3f(ndcMinX, ndcMinY, farZ), invProj),
        reconstructViewPos(vec3f(ndcMaxX, ndcMinY, farZ), invProj),
        reconstructViewPos(vec3f(ndcMaxX, ndcMaxY, farZ), invProj),
        reconstructViewPos(vec3f(ndcMinX, ndcMaxY, farZ), invProj)
    );

    let frustumCenter = (corners[0] + corners[1] + corners[2] + corners[3] +
                    corners[4] + corners[5] + corners[6] + corners[7]) / 8.0;

    var planes: array<vec4f, 6>;

    // left
    planes[0] = computePlaneFromPoints(
        corners[0], corners[3], corners[4], frustumCenter);

    // right
    planes[1] = computePlaneFromPoints(
        corners[1], corners[5], corners[2], frustumCenter);

    // bottom
    planes[2] = computePlaneFromPoints(
        corners[0], corners[4], corners[1], frustumCenter);

    // top
    planes[3] = computePlaneFromPoints(
        corners[3], corners[2], corners[7], frustumCenter);

    // near
    planes[4] = computePlaneFromPoints(
        corners[0], corners[1], corners[3], frustumCenter);

    // far
    planes[5] = computePlaneFromPoints(
        corners[4], corners[7], corners[5], frustumCenter);
        

    return planes;
}

@group(0) @binding(0) var<storage, read> occluders: array<SphereOccluder>;
@group(0) @binding(1) var<storage, read_write> occlusionResults: array<OcclusionOutput>;
@group(1) @binding(0) var<uniform> lightOptions: LightOptionsUniforms;
@group(1) @binding(1) var<uniform> camera: CameraUniforms;
@group(1) @binding(2) var<uniform> config: Config;


/*
    One work group getting one tile
    Get all occluders in parallel
*/

const WG_SIZE: u32 = WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y;
var<workgroup> numOccluders: atomic<u32>;
var<workgroup> sharedOccluders: array<u32, NUM_POSSIBLE_OCCLUDERS>;
@compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y, 1)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>,
        @builtin(local_invocation_id) localId: vec3<u32>,
        @builtin(workgroup_id) workgroupId: vec3<u32>) {
    var lightDir = normalize((camera.viewMatrix * vec4f(lightOptions.dir.xyz, 0.0)).xyz);

    let tileY = workgroupId.y;
    let tileX = workgroupId.x + 1;

    let frustumCorners = getTileFrustum(tileX, tileY, SCREEN, camera.invProjMatrix, config);

    if (localId.x == 0u && localId.y == 0u) {
        atomicStore(&numOccluders, 0u);
    }
    workgroupBarrier();

    // GET OCCLUDERS FOR EACH TILE
    let threadIndex = localId.x;
    let totalThreads = TOTAL_THREADS;
    for (var i = threadIndex; i < arrayLength(&occluders); i += totalThreads) {
        let centerPos1 = camera.viewMatrix * vec4f(occluders[i].center.xyz * 0.01, 1.0);
        
        //sphereProjectedAlongLightIntersectsTile(frustumCorners, centerPos1.xyz, occluders[i].center.w * 0.01, lightDir)
        if (sphereProjectedAlongLightIntersectsTile(frustumCorners, centerPos1.xyz, occluders[i].center.w * 0.05, lightDir)) {
            let index = atomicAdd(&numOccluders, 1u);
            if (index < NUM_POSSIBLE_OCCLUDERS) {
                sharedOccluders[index - 1] = i;
            }
        }
    }
    workgroupBarrier();

    // get answer
    let tileId = tileY * config.tilesX + tileX;
    let finalCount = atomicLoad(&numOccluders);
    if (threadIndex == 0u) {
        let c = f32(min(finalCount, NUM_POSSIBLE_OCCLUDERS));
        occlusionResults[tileId].count = vec4f(c, c, c, 1.0);
    }

    for (var i = threadIndex; i < min(finalCount, NUM_POSSIBLE_OCCLUDERS); i += totalThreads) {
        occlusionResults[tileId].indices[i] = sharedOccluders[i];
    }
}