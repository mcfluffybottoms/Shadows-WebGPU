struct FragmentIn {
    @location(1) fragPos: vec4<f32>,
    @location(2) fragNorm: vec3<f32>,
    @location(3) clipPos: vec4f,
    @builtin(position) Position: vec4f,
}

struct GBufferOutput {
    @location(0) albedo: vec4f,
    @location(1) normal: vec4f,
    @location(2) position: vec4f
}

fn OcclusionTest(
    direction: vec3<f32>,
    sphereCenter: vec3<f32>,
    sphereRadius: f32,
    point: vec3<f32>,
) -> f32 {
    let distVector: vec3<f32> = sphereCenter - point;
    let distance = length(distVector);

    // get radius projectred from occcluded sphere
    let occluderConeSin = sphereRadius / distance;
    let radius1 = asin(occluderConeSin) * config.hemisphereRadius;

    // get radius projectred from light source
    let lightConeAngle = config.coneAngle * DEG_TO_RAD;
    let radius2 = lightConeAngle * config.hemisphereRadius;

    // get radius projectred from light source
    let distNormalized = normalize(distVector);
    let dirNormalized = normalize(direction);
    let distanceAngle = acos(clamp(dot(distNormalized, dirNormalized), -1.0, 1.0));
    let circlesArcDistance = config.hemisphereRadius * distanceAngle;
    return sphericalCapIntersectionApprox(radius1, radius2, circlesArcDistance);
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<uniform> object: ObjectUniforms;
@group(1) @binding(3) var objTexture: texture_2d<f32>;
@group(1) @binding(4) var objSampler: sampler;

@fragment
fn main(in: FragmentIn) -> GBufferOutput {
    let albedoColor = textureSample(objTexture, objSampler, vec2(1.0, 1.0));

    var output = GBufferOutput(
        vec4f(albedoColor.rgb, 1.0),
        vec4f(in.fragNorm, 1.0),
        in.fragPos
    );

    return output;
}