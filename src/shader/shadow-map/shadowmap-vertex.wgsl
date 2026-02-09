struct LightUniforms {
    viewProjMatrix: mat4x4<f32>,
    pos: vec4f,
    dir: vec4f,
};
struct CameraUniforms {
    viewProjMatrix: mat4x4<f32>,
    pos: vec4f,
};
struct ObjectUniforms {
    modelMatrix : mat4x4<f32>,
    normalMatrix: mat4x4<f32>,
};
struct Vertex {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
};
struct VertexOut {
    @location(0) fragPosLightSpace: vec4<f32>,
    @location(1) fragPos: vec3<f32>,
    @location(2) fragNorm: vec3<f32>,
    @builtin(position) Position: vec4f,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<uniform> light: LightUniforms;
@group(0) @binding(2) var<uniform> object: ObjectUniforms;
@vertex
fn main(v: Vertex) -> VertexOut {
    let worldPos = object.modelMatrix * vec4f(v.position, 1.0);
    let posi = camera.viewProjMatrix * worldPos;
    let lightPos = light.viewProjMatrix * worldPos;
    
    let posFromLight = lightPos;
    
    var output: VertexOut;
    output.fragPosLightSpace = lightPos;
    output.Position = posi;
    output.fragPos = worldPos.xyz;
    output.fragNorm = (object.normalMatrix * vec4f(v.normal, 0.0)).xyz;
    
    return output;
}