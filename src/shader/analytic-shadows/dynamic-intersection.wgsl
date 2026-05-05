struct SphereOccluder {
    radius: f32,
    center: vec3<f32>,
};

struct LightOptionsUniforms {
    pos: vec4f,
    dir: vec4f,
    splits: array<vec4f, 8>
};

const PI = 3.14159265;
const DEG_TO_RAD = 3.14159265 / 180.0;

const NUM_TILES = 50;
const NUM_OCCLUDERS_X = 5;
const NUM_OCCLUDERS_Z = 5;
const WIDTH = 50;
const HEIGHT = 50;
const START_X = -25;
const START_Z = -25;
const TILES_X = 10;
const TILES_Z = 5;

fn aabbSphereTest(aabbMin: vec3f, aabbMax: vec3f, sphereCenter: vec3f, sphereRadius: f32) -> bool {
    var closestPoint: vec3f;
    closestPoint.x = clamp(sphereCenter.x, aabbMin.x, aabbMax.x);
    closestPoint.y = clamp(sphereCenter.y, aabbMin.y, aabbMax.y);
    closestPoint.z = clamp(sphereCenter.z, aabbMin.z, aabbMax.z);
    
    let diff = sphereCenter - closestPoint;
    let distanceSq = dot(diff, diff);
    return distanceSq <= sphereRadius * sphereRadius;
}

/*
    Ambient Aperture Lighting -- Chris Oat, Pedro V. Sander
*/
fn sphericalCapIntersectionApprox(
    radius1: f32,
    radius2: f32,
    dist: f32,
) -> f32 {
    var area: f32 = 0.0;

    if(dist >= radius1 + radius2) {
        return area;
    }

    area = 6.283185308 - 6.283185308 * cos(min(radius1, radius2));

    if(dist > max(radius1, radius2) - min(radius1, radius2)) {
        let diff = abs(radius1 - radius2);
        area *= smoothstep(0.0, 1.0, 1.0 - saturate((dist - diff)/(radius1 + radius2 - diff)));
    }

    return area;
}

fn ambientComponent(
    sphereRadius: f32,
    sphereCenter: vec3<f32>,
    point: vec3<f32>,
) -> f32 {
    let distance = length(sphereCenter - point);
    return (sphereRadius / distance) * (sphereRadius / distance);
}

fn dynamicComponent(
    direction: vec3<f32>,
    normal: vec3<f32>,
    sphereCenter: vec3<f32>,
    sphereRadius: f32,
    point: vec3<f32>,
) -> f32 {
    let distVector: vec3<f32> = sphereCenter - point;
    let distance = length(distVector);

    // get radius projectred from occcluded sphere
    let occluderConeSin = sphereRadius / distance;
    let radius1 = asin(occluderConeSin) * HEMISPHERE_RADIUS;

    // get radius projectred from light source
    let lightConeAngle = CONE_ANGLE * DEG_TO_RAD;
    let radius2 = lightConeAngle * HEMISPHERE_RADIUS;

    // get radius projectred from light source
    let cosAngle: f32 = dot(distVector, direction) / (distance * length(direction));
    let circlesDistance: f32 = HEMISPHERE_RADIUS * HEMISPHERE_RADIUS * 2 * (1.0 - cosAngle);
    
    let distNormalized = normalize(distVector);
    let dirNormalized = normalize(direction);
    let distanceAngle = acos(clamp(dot(distNormalized, dirNormalized), -1.0, 1.0));
    let circlesArcDistance = HEMISPHERE_RADIUS * distanceAngle;
    return sphericalCapIntersectionApprox(radius1, radius2, circlesArcDistance);
}


@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>,
        @builtin(local_invocation_id) localId: vec3<u32>,
        @builtin(workgroup_id) workgroupId: vec3<u32>) {
    let tileX = workgroupId.x;
    let tileY = workgroupId.y;
    let tileIndex = tileY * frameUniforms.numTiles.x + tileX;


}