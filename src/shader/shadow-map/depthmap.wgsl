struct LightUniforms {
    viewProjMatrix: mat4x4<f32>,
};
struct Vertex {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
};
struct ObjectUniforms {
    modelMatrix : mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> light: LightUniforms;
@group(0) @binding(1) var<uniform> object: ObjectUniforms;
@vertex
fn main(v: Vertex) -> @builtin(position) vec4f {
    let clipPos = light.viewProjMatrix * object.modelMatrix * vec4f(v.position, 1.0);
    //let clipPos1 = light.viewProjMatrix * object.modelMatrix * vec4f(v.position, 1.0);
    return vec4f(clipPos.x, clipPos.y, clipPos.z * 0.5 + 0.5, clipPos.w);
}
