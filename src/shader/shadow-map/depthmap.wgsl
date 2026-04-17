struct LightUniforms {
    viewProjMatrix: mat4x4<f32>,
};
struct Vertex {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
};
struct ObjectUniforms {
    modelMatrix : mat4x4<f32>,
    normalMatrix: mat4x4<f32>,
    objectId: i32
};
struct Config {
    shadowMapOn: u32,
    samplesPerSide: u32,
    numOfCascades: u32,
    biasType: u32,
    lightOn: u32,
    cascadeLayers: u32,
    biasValue: f32
};

@group(0) @binding(0) var<uniform> object: ObjectUniforms;
@group(0) @binding(1) var<uniform> config: Config;
@group(1) @binding(0) var<uniform> light: LightUniforms;
@vertex
fn main(v: Vertex, @builtin(instance_index) cascade: u32) -> @builtin(position) vec4f {
    var clipPos = light.viewProjMatrix * object.modelMatrix * vec4f(v.position, 1.0);
    
    if(config.shadowMapOn == 0) {}

    return vec4f(clipPos.x, clipPos.y, clipPos.z * 0.5 + 0.5, clipPos.w);
}
