const MAX_CASCADES = 16;

// ----- SCENE SETUP ----- // 
struct LightOptionsUniforms {
    pos: vec4f,
    dir: vec4f,
    splits: array<vec4f, MAX_CASCADES>
};
struct Config {
    shadowMapOn: u32,
    samplesPerSide: u32,
    numOfCascades: u32
};


@group(0) @binding(2) var depthTex: texture_depth_2d_array;
@group(0) @binding(3) var depthSampler: sampler_comparison;
// // ----- SCENE SETUP ----- // 

struct FragmentIn {
    @location(0) fragPosLightSpace: vec4<f32>,
    @location(1) fragPos: vec3<f32>,
    @location(2) fragNorm: vec3<f32>,
    @location(3) cascadeId: u32,
}

@group(1) @binding(1) var<uniform> light: LightOptionsUniforms;
@group(1) @binding(2) var<uniform> config: Config;


const albedo = vec3f(0.9);
const ambientFactor = 0.1;

fn shadowCalculation(in: FragmentIn, normal: vec3f, lightDir: vec3f) -> f32 {
    var projCoords = in.fragPosLightSpace.xyz / in.fragPosLightSpace.w;
    projCoords.x = projCoords.x *0.5 + 0.5;
    projCoords.y = -projCoords.y *0.5 + 0.5;
    projCoords.z = projCoords.z *0.5 + 0.5;
    if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 ||
        projCoords.y < 0.0 || projCoords.y > 1.0) {
        return 1.0;
    }
    
    // smoothing
    var shadow = 0.0;
    let texelSize = 1.0 / vec2f(textureDimensions(depthTex));
    
    let maxBias = 0.001;
    let baseBias = 0.001;
    let dx = dpdx(projCoords.z);
    let dy = dpdy(projCoords.z);
    let slopeScale = abs(dx) + abs(dy);
    let bias = min(baseBias + slopeScale * 0.5, maxBias);
    
    let texSize = vec2f(textureDimensions(depthTex));
    let snappedCoords = vec2f(
        floor(projCoords.x * texSize.x) / texSize.x + texelSize.x * 0.5,
        floor(projCoords.y * texSize.y) / texSize.y + texelSize.y * 0.5
    );
    let halfWindow = i32(config.samplesPerSide) / 2;
    for(var i = -1 * halfWindow; i <= halfWindow; i++) {
        for(var j = -1 * halfWindow; j <= halfWindow; j++) {
            let offset = vec2f(f32(i), f32(j)) * texelSize;

            // set cascade id

            shadow += textureSampleCompare(
                depthTex, 
                depthSampler,
                snappedCoords + offset,
                in.cascadeId,
                projCoords.z - bias
            );
        }
    }
    shadow /= f32(config.samplesPerSide) * f32(config.samplesPerSide);

    if(shadow > 1.0) {
        return 1.0;
    }
    
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
    var shadow = 1.0;
    if(config.shadowMapOn == 1) {
        shadow = shadowCalculation(in, normal, lightDir);
    }

    // lighting
    let lighting = (ambientFactor + (shadow) * (diffuse + 0.0)) * color;
    
    return vec4f(lighting, 1.0);
}