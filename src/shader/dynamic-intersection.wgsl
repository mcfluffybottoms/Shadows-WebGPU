struct SphereOccluder {
    center: vec3<f32>,
};

struct LightOptionsUniforms {
    pos: vec4f,
    dir: vec4f,
    splits: array<vec4f, 8>
};

const CONE_ANGLE = 8.0;
const HEMISPHERE_RADIUS = 1.0;
const SPHERE_RADIUS = 1.0;

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
    point: vec3<f32>,
) -> f32 {
    let distVector: vec3<f32> = sphereCenter - point;
    let distance = length(distVector);
    let radius1: f32 = tan(CONE_ANGLE * 3.14159265 / 180.0) * HEMISPHERE_RADIUS;
    let radius2: f32 = (SPHERE_RADIUS / distance) * sqrt(distance * distance - SPHERE_RADIUS * SPHERE_RADIUS);
    
    let cosAngle: f32 = dot(distVector, direction) / (distance * length(direction));
    let circlesDistance: f32 = HEMISPHERE_RADIUS * HEMISPHERE_RADIUS * 2 * (1 - cosAngle) ;
    return sphericalCapIntersectionApprox(radius1, radius2, circlesDistance) * dot(direction, normal);
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {

}