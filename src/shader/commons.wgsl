const PI = 3.14159265;
const DEG_TO_RAD = 3.14159265 / 180.0;

const MAX_CASCADES = 8;

const SCREEN = vec2<u32>(1024, 1024);

const NUM_POSSIBLE_OCCLUDERS = 128u;
const WORKGROUP_SIZE_X = 8u;
const WORKGROUP_SIZE_Y = 8u;
const TOTAL_THREADS = WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y;
const influenceRadius = 10.0;


// objects data
struct Vertex {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
}
struct ObjectUniforms {
    modelMatrix : mat4x4<f32>,
    normalMatrix: mat4x4<f32>,
    entityId: f32
}

// light data
struct LightUniforms {
    viewProjMatrix: mat4x4<f32>,
}
struct SnatchedLightUniforms {
    viewProjMatrix: array<mat4x4<f32>, MAX_CASCADES>,
}
struct LightOptionsUniforms {
    pos: vec4f,
    dir: vec4f,
    splits: array<vec4f, MAX_CASCADES>
}

// configuration
struct Config {
    shadowMapOn: u32,
    analyticShadowsOn: u32,
    samplesPerSide: u32,
    numOfCascades: u32,
    biasType: u32,
    lightOn: u32,
    cascadeLayers: u32,
    seeGrid: u32,
    directionalOn: u32,
    ambientOn: u32,
    tilesX: u32,
    tilesY: u32,
    biasValue: f32,
    lightAmbient: f32,
    coneAngle: f32,
    hemisphereRadius: f32,
    dirStrength: f32,
    ambStrength: f32
}

// cameras
struct CameraUniforms {
    viewProjMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>,
    invProjMatrix: mat4x4<f32>,
    projMatrix: mat4x4<f32>,
    pos: vec4f
}

// appproximators by simple objects

struct OcclusionOutput {
    count: vec4f, // count + radius
    indices: array<u32, NUM_POSSIBLE_OCCLUDERS>,
}

struct SphereOccluder {
    center: vec4<f32>, // center + radius
}

struct SphereOptions {
    modelMatrix: mat4x4<f32>,
    scale: vec4f,
}