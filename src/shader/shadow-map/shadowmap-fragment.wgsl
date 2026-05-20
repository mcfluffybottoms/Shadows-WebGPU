// ----- SCENE SETUP ----- // 
@group(0) @binding(2) var staticDepthTex: texture_depth_2d_array;
@group(0) @binding(3) var dynamicDepthTex: texture_depth_2d_array;
@group(0) @binding(4) var depthSampler: sampler_comparison;
@group(0) @binding(5) var objTexture: texture_2d<f32>;
@group(0) @binding(6) var objSampler: sampler;

@group(1) @binding(0) var<uniform> light: SnatchedLightUniforms;
@group(1) @binding(1) var<uniform> lightOptions: LightOptionsUniforms;
@group(1) @binding(2) var<uniform> config: Config;
@group(1) @binding(3) var<storage, read> occluders: array<SphereOccluder>;
@group(1) @binding(4) var<storage, read_write> occlusionResults: array<OcclusionOutput>;
@group(1) @binding(5) var<storage, read> occludersMatrix: array<SphereOptions>;
@group(1) @binding(6) var<storage, read> occludersEntityIds: array<vec2u>;
@group(1) @binding(7) var<storage, read> textures: array<vec2u>;
@group(1) @binding(8) var<storage, read> entities: array<f32>;
// ----- SCENE SETUP ----- // 

struct FragmentIn {
    @location(1) fragPos: vec4<f32>,
    @location(2) fragNorm: vec3<f32>,
    @location(3) clipPos: vec4f,
    @location(4) uv: vec2<f32>,
    @location(5) entityId: u32,
}

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
        if (abs(in.clipPos.z) < split) {
            return u32(i);
        }
    }
    return u32(numOfCascades);
}

fn getBias(projCoords: vec3f) -> f32 {
    var bias = config.biasValue;
    let maxBias = config.biasValue;
    let baseBias = bias;
    let dx = dpdx(projCoords.z);
    let dy = dpdy(projCoords.z);
    let slopeScale = abs(dx) + abs(dy);
    bias = min(baseBias + slopeScale * 0.5, maxBias);
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
            var staticSample = 1.0;
            var dynamicSample = 1.0;
            if (config.shadowMapOn == u32(1)) {
                staticSample = textureSampleCompare(
                    staticDepthTex, 
                    depthSampler,
                    snappedCoords + offset,
                    cascadeId,
                    projCoords.z - bias
                );
            }
            if (config.shadowMapDynamicOn == u32(1)) {
                dynamicSample = textureSampleCompare(
                    dynamicDepthTex, 
                    depthSampler,
                    snappedCoords + offset,
                    cascadeId,
                    projCoords.z - bias
                );
            }

            shadow += staticSample * dynamicSample;
        }
    }
    shadow /= f32(config.samplesPerSide) * f32(config.samplesPerSide);

    return saturate(shadow);
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

fn dynamicComponent(
    direction: vec3<f32>,
    sphereCenter: vec3<f32>,
    sphereRadius: f32,
    point: vec3<f32>,
) -> f32 {
    let distVector = sphereCenter - point;
    let distance = length(distVector);
    
    let occluderAngularRadius = asin(min(1.0, sphereRadius / distance));
    
    let lightAngularRadius = config.coneAngle * DEG_TO_RAD;
    
    let distNormalized = distVector / distance;
    let dirNormalized = normalize(direction);
    let angularDistance = acos(clamp(dot(distNormalized, dirNormalized), -1.0, 1.0)) * config.hemisphereRadius;
    
    return sphericalCapIntersectionApprox(
        occluderAngularRadius, 
        lightAngularRadius, 
        angularDistance
    );
}

fn ambientComponent(
    sphereRadius: f32,
    sphereCenter: vec3<f32>,
    point: vec3<f32>,
) -> f32 {
    let distance = length(sphereCenter - point);
    return (sphereRadius / distance) * (sphereRadius / distance);
}

fn combineOcclusion(existing: f32, newOcclusion: f32) -> f32 {
    let existingLight = 1.0 - existing;
    let newLight = 1.0 - newOcclusion;
    let combinedLight = existingLight * newLight;
    return 1.0 - combinedLight;
}

fn shadowCalculation1(in: FragmentIn, normal: vec3f, lightDir: vec3f, config: Config) -> vec2f {
    let ndc = in.clipPos.xy / in.clipPos.w;
    let screenPos = vec2<f32>(
        (ndc.x * 0.5 + 0.5) * f32(SCREEN.x),
        -(ndc.y * 0.5 - 0.5) * f32(SCREEN.y),
    );

    let STEP_X = f32(SCREEN.x) / f32(config.tilesX);
    let STEP_Y = f32(SCREEN.y) / f32(config.tilesY);
    let tileX = u32(ceil(screenPos.x / STEP_X));
    let tileY = u32(ceil(screenPos.y / STEP_Y));
    let tileId = tileY * config.tilesX + tileX;

    var dyn = 0.0;
    var amb = 0.0;

    for (var i: u32 = 0; i < u32(occlusionResults[tileId].count.x); i++) {
        let occluderId = occlusionResults[tileId].indices[i];
        let occluder = occluders[occluderId];

        let eid = occludersEntityIds[occluderId];
        if (in.entityId == eid[1]) {
            continue;
        }

        let modelMatrix = occludersMatrix[eid[0]].modelMatrix;
        let scale = occludersMatrix[eid[0]].scale;
        var centerPos_world = modelMatrix * vec4f(
            occluder.center.xyz, 
            1.0
        );
        var radius_world = occluder.center.w * scale[0];

        if (config.directionalOn == 1) {
            let loc_dyn = dynamicComponent(
                lightDir,
                centerPos_world.xyz,
                radius_world,
                in.fragPos.xyz
            );
            dyn = combineOcclusion(dyn, loc_dyn);
        }

        if (config.ambientOn == 1) {
            let loc_amb = ambientComponent(
                radius_world,
                centerPos_world.xyz,
                in.fragPos.xyz
            );
            amb = combineOcclusion(amb, loc_amb);
        }
    }

    return vec2f(1.0 - dyn, amb);
}

@fragment
fn main(in: FragmentIn) -> @location(0) vec4f {
    var color = textureSample(objTexture, objSampler, in.uv).rgb;
    color = vec3f(0.9, 0.9, 0.9);
    let normal = normalize(in.fragNorm);

    // light direction
    var lightDir = normalize(-1 * lightOptions.dir.xyz);
    lightDir.z = -1 * lightDir.z;
    
    // diffuse
    let diff = max(dot(normal, lightDir), 0.0);
    let diffuse = max(dot(normal, lightDir), 0.0);

    // shadow
    var shadow = 1.0;
    var amb = config.lightAmbient;
    var cascadeId = getCascadeId(in);

    if (config.analyticShadowsOn == 1) {
        let components = shadowCalculation1(in, normal, lightDir, config);
        shadow = components[0] * config.dirStrength;
        amb -= components[1] * config.ambStrength;
    }

    if (config.shadowMapOn == 1) {
        shadow *= mix(1.0, shadowCalculation(in, normal, lightDir), 0.5);
    } 

    // lighting
    if (config.cascadeLayers == 1) {
        color = colors[cascadeId];
    }

    var lighting = color;

    // light
    if(config.lightOn == 1) {
        lighting = (amb + shadow * (diffuse + 0.0)) * color;
    } else {
        lighting = shadow * color;
    }

    // DEBUG - cascades
    var finalColor = lighting;
    if(config.shadowMapOn == 1 && config.cascadeLayers == 1) {
        finalColor = mix(lighting, lighting * colors[cascadeId], 0.3);
    }

    // DEBUG - SHOW WHICH TILES HAVE OCCLUDERS
    if (config.seeGrid == 1) {
        let ndc = in.clipPos.xyz / in.clipPos.w;
        let screenPos = vec2<f32>(
            (ndc.x * 0.5 + 0.5) * f32(SCREEN.x),
            (-ndc.y * 0.5 + 0.5) * f32(SCREEN.y)
        );

        let STEP_X = f32(SCREEN.x) / f32(config.tilesX);
        let STEP_Y = f32(SCREEN.y) / f32(config.tilesY);
        let tileX = u32(ceil(screenPos.x / STEP_X));
        let tileY = u32(ceil(screenPos.y / STEP_Y));
        let tileId = tileY * config.tilesX + tileX;


        let addedColor = vec3f(occlusionResults[tileId].count.xyz / f32(arrayLength(&occluders)));
        return vec4f(mix(finalColor, addedColor, 0.7), 1.0);
    }

    return vec4f(finalColor, 1.0);
}