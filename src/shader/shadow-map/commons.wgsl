const MAX_CASCADES = 8;

// objects data
struct Vertex {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
}
struct ObjectUniforms {
    modelMatrix : mat4x4<f32>,
    normalMatrix: mat4x4<f32>,
    objectId: i32
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
    samplesPerSide: u32,
    numOfCascades: u32,
    biasType: u32,
    lightOn: u32,
    cascadeLayers: u32,
    biasValue: f32,
    lightAmbient: f32
}

// cameras
struct CameraUniforms {
    viewProjMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>,
    pos: vec4f
}