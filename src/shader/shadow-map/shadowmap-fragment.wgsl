// ----- SCENE SETUP ----- // 
@group(0) @binding(2) var staticDepthTex: texture_depth_2d_array;
@group(0) @binding(3) var dynamicDepthTex: texture_depth_2d_array;
@group(0) @binding(4) var depthSampler: sampler_comparison;
@group(0) @binding(5) var objTexture: texture_2d<f32>;
@group(0) @binding(6) var objSampler: sampler;

// // ----- SCENE SETUP ----- // 

struct FragmentIn {
    @location(1) fragPos: vec4<f32>,
    @location(2) fragNorm: vec3<f32>,
    @location(3) clipPosZ: f32,
    @location(4) uv: vec2<f32>
}

@group(1) @binding(0) var<uniform> light: SnatchedLightUniforms;
@group(1) @binding(1) var<uniform> lightOptions: LightOptionsUniforms;
@group(1) @binding(2) var<uniform> config: Config;

// colors for cascade
const colors: array<vec3f, MAX_CASCADES> = array<vec3f, MAX_CASCADES>(
    vec3f(1.0, 0.0, 0.0), // Red
    vec3f(0.0, 1.0, 0.0), // Green
    vec3f(0.0, 0.0, 1.0), // Blue
    vec3f(1.0, 1.0, 0.0), // Yellow
    vec3f(1.0, 0.0, 1.0), // Magenta
    vec3f(0.0, 1.0, 1.0), // Cyan
    vec3f(1.0, 0.5, 0.0), // Orange
    vec3f(0.5, 0.0, 1.0)  // Purple
);

fn getCascadeId(in: FragmentIn) -> u32 {
    let numOfCascades = i32(config.numOfCascades);
    
    for (var i = 0; i < numOfCascades; i++) {
        let split = lightOptions.splits[i].y;
        if (abs(in.clipPosZ) < split) {
            return u32(i);
        }
    }
    return u32(numOfCascades);
}

fn getBias(projCoords: vec3f) -> f32 {
    var bias = config.biasValue;
    if (config.biasType == 0) {
        let maxBias = config.biasValue;
        let baseBias = 0.001;
        let dx = dpdx(projCoords.z);
        let dy = dpdy(projCoords.z);
        let slopeScale = abs(dx) + abs(dy);
        bias = min(baseBias + slopeScale * 0.5, maxBias);
    }
    return bias;
}

fn shadowCalculation(in: FragmentIn, normal: vec3f, lightDir: vec3f) -> f32 {

    // select cascade 
    var cascadeId = getCascadeId(in);

    // light fragment pos
    var projCoordsXYZW = light.viewProjMatrix[cascadeId] * in.fragPos;
    var projCoords = projCoordsXYZW.xyz / projCoordsXYZW.w;
    projCoords.x = projCoords.x * 0.5 + 0.5;
    projCoords.y = -projCoords.y * 0.5 + 0.5;
    projCoords.z = projCoords.z * 0.5 + 0.5;
    if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 ||
        projCoords.y < 0.0 || projCoords.y > 1.0) {
        return 1.0;
    }
    
    var shadow = 0.0;

    // bias
    var bias = getBias(projCoords);
    
    // texel snapping
    let texelSize = 1.0 / vec2f(textureDimensions(staticDepthTex));
    let texSize = vec2f(textureDimensions(dynamicDepthTex));
    let snappedCoords = vec2f(
        floor(projCoords.x * texSize.x) / texSize.x + texelSize.x * 0.5,
        floor(projCoords.y * texSize.y) / texSize.y + texelSize.y * 0.5
    );

    // smoothing
    let halfWindow = i32(config.samplesPerSide) / 2;
    for (var i = -1 * halfWindow; i <= halfWindow; i++) {
        for (var j = -1 * halfWindow; j <= halfWindow; j++) {
            let offset = vec2f(f32(i), f32(j)) * texelSize;
            let staticSample = textureSampleCompare(
                staticDepthTex, 
                depthSampler,
                snappedCoords + offset,
                cascadeId,
                projCoords.z - bias
            );
            let dynamicSample = textureSampleCompare(
                dynamicDepthTex, 
                depthSampler,
                snappedCoords + offset,
                cascadeId,
                projCoords.z - bias
            );

            shadow += staticSample * dynamicSample;
        }
    }
    shadow /= f32(config.samplesPerSide) * f32(config.samplesPerSide);

    if (shadow > 1.0) {
        return 1.0;
    }
    
    return shadow;
}

@fragment
fn main(in: FragmentIn) -> @location(0) vec4f {
    var color = textureSample(objTexture, objSampler, in.uv).rgb;
    let normal = normalize(in.fragNorm);

    // light direction
    var lightDir = normalize(-1 * lightOptions.dir.xyz);
    lightDir.z = -1 * lightDir.z;
    
    // diffuse
    let diff = max(dot(normal, lightDir), 0.0);
    let diffuse = diff * vec3f(1.0, 1.0, 1.0);

    // shadow
    var shadow = 1.0;
    var cascadeId = getCascadeId(in);
    if (config.shadowMapOn == 1) {
        shadow = shadowCalculation(in, normal, lightDir);
    }

    // lighting
    if (config.shadowMapOn == 1 && config.cascadeLayers == 1) {
        color = colors[cascadeId];
    }

    var lighting = color;
    // if need phong light
    if (config.lightOn == 1) {
        lighting = (config.lightAmbient + shadow * (diffuse + 0.0)) * color;
    } else {
        lighting = shadow * color;
    }

    // if need debug for cascades
    var finalColor = lighting;

    return vec4f(finalColor, 1.0);
}