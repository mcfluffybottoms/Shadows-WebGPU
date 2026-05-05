const PI = 3.14159265;
const DEG_TO_RAD = 3.14159265 / 180.0;

// ----- SCENE SETUP ----- // 
@group(0) @binding(2) var staticDepthTex: texture_depth_2d_array;
@group(0) @binding(3) var dynamicDepthTex: texture_depth_2d_array;
@group(0) @binding(4) var depthSampler: sampler_comparison;

// // ----- SCENE SETUP ----- // 

struct FragmentIn {
    @location(1) fragPos: vec4<f32>,
    @location(2) fragNorm: vec3<f32>,
    @location(3) clipPosZ: f32
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

const CONE_ANGLE = 5.0;
const HEMISPHERE_RADIUS = 5.0;


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
    //let radius1: f32 = tan(CONE_ANGLE * 3.14159265 / 180.0) * HEMISPHERE_RADIUS;
    //let radius2: f32 = (sphereRadius / distance) * sqrt(distance * distance - sphereRadius * sphereRadius);
    // let cosAngle: f32 = dot(distVector, direction) / (distance * length(direction));
    // let circlesDistance: f32 = HEMISPHERE_RADIUS * HEMISPHERE_RADIUS * 2 * (1.0 - cosAngle) ;

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
// fn shadowCalculation1(in: FragmentIn, normal: vec3f, lightDir: vec3f) -> f32 {
//     const SPHERE_RADIUS = 1.0;
//     let position = vec3f(in.fragPos.x, in.fragPos.y, in.fragPos.z);
//     let sphereCenter = vec3f(0.0, 1.0, 0.0);
//     let dyn = dynamicComponent(lightDir, normal, sphereCenter, SPHERE_RADIUS, position);

//     let shadow = (1.0 - dyn) ;
//     return dyn;
// }


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
    for(var i = -1 * halfWindow; i <= halfWindow; i++) {
        for(var j = -1 * halfWindow; j <= halfWindow; j++) {
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
    var lightDir = normalize(-1 * lightOptions.dir.xyz);
    lightDir.z = -1 * lightDir.z;
    
    // diffuse
    let diff = max(dot(normal, lightDir), 0.0);
    let diffuse = max(dot(normal, lightDir), 0.0);

    // shadow
    var shadow = 1.0;
    var cascadeId = getCascadeId(in);
    if(config.shadowMapOn == 1) {
        shadow = shadowCalculation(in, normal, lightDir);
    } 

    // lighting
    var lighting = color;

    // ambient
    const SPHERE_RADIUS = 1.0;
    let position = vec3f(in.fragPos.x, in.fragPos.y, in.fragPos.z);
    let sphereCenter = vec3f(0.0, 1.0, 0.0);
    let amb = 1.0 - ambientComponent(
        SPHERE_RADIUS,
        sphereCenter,
        position)
    - config.lightAmbient;

    // if need phong light
    if(config.lightOn == 1) {
        lighting = (amb + shadow * (diffuse + 0.0)) * color;
    } else {
        lighting = shadow * color;
    }

    // if need debug for cascades
    var finalColor = lighting;
    if(config.shadowMapOn == 1 && config.cascadeLayers == 1) {
        finalColor = mix(lighting, lighting * colors[cascadeId], 0.7);
    }

    return vec4f(finalColor, 1.0);
}