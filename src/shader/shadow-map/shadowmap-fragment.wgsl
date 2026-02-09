override shadowDepthTextureSize: f32 = 1024.0;

struct LightUniforms {
    viewProjMatrix: mat4x4<f32>,
    pos: vec4f,
    dir: vec4f,
};
struct CameraUniforms {
    viewProjMatrix: mat4x4<f32>,
    pos: vec4f,
};
struct FragmentIn {
    @location(0) fragPosLightSpace: vec4<f32>,
    @location(1) fragPos: vec3<f32>,
    @location(2) fragNorm: vec3<f32>,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<uniform> light: LightUniforms;
@group(0) @binding(3) var depthTex: texture_depth_2d;
@group(0) @binding(4) var depthSampler: sampler_comparison;

const albedo = vec3f(0.9);
const ambientFactor = 0.1;

fn shadowCalculation(in: FragmentIn) -> f32 {
    var projCoords = in.fragPosLightSpace.xyz / in.fragPosLightSpace.w;
    projCoords.x = projCoords.x *0.5 + 0.5;
    projCoords.y = -projCoords.y *0.5 + 0.5;
    projCoords.z = projCoords.z *0.5 + 0.5;
    if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 ||
        projCoords.y < 0.0 || projCoords.y > 1.0) {
        return 1.0;
    }
    let lightDir = normalize(light.dir.xyz);
    let bias = max(0.05 * (1.0 - dot(normalize(in.fragNorm), lightDir)), 0.0005);
    // smoothing
    var shadow = 0.0;
    let texelSize = 1.0 / vec2f(textureDimensions(depthTex));
    for(var i = -1; i <= 1; i++) {
        for(var j = -1; j <= 1; j++) {
            let offset = vec2f(f32(i), f32(j)) * texelSize;
            shadow += textureSampleCompare(
                depthTex, 
                depthSampler,
                projCoords.xy + offset,
                projCoords.z - 0.01
            );
        }
    }
    shadow /= 9.0;
    
    return shadow;
}

@fragment
fn main(in: FragmentIn) -> @location(0) vec4f {
    let color = vec3f(1.0, 1.0, 1.0);
    let normal = normalize(in.fragNorm);

    // light direction
    let lightDir = normalize(light.dir.xyz);

    // diffuse
    let diff = max(dot(lightDir, normal), 0.0);
    let diffuse = diff * vec3f(1.0, 1.0, 1.0);

    // shadow
    let shadow = shadowCalculation(in);

    // lighting
    let lighting = (ambientFactor + (shadow) * (diffuse + 0.0)) * color;
    
    return vec4f(lighting, 1.0);
}