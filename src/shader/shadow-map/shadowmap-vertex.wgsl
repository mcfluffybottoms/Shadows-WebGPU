struct VertexOut {
    @location(1) fragPos: vec4<f32>,
    @location(2) fragNorm: vec3<f32>,
    @location(3) clipPos: vec4f,
    @location(4) uv: vec2<f32>,
    @location(5) @interpolate(flat) entityId: u32,
    @builtin(position) Position: vec4f,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<uniform> object: ObjectUniforms;
@group(1) @binding(0) var<uniform> light: LightUniforms;
@group(1) @binding(1) var<uniform> lightOptions: LightOptionsUniforms;
@group(1) @binding(2) var<uniform> config: Config;

@vertex
fn main(v: Vertex) -> VertexOut {
    let worldPos = object.modelMatrix * vec4f(v.position, 1.0);

    // to output
    var output: VertexOut;
    output.Position = camera.viewProjMatrix * worldPos;
    output.fragPos = worldPos;
    output.clipPos = output.Position;
    output.fragNorm = (object.normalMatrix * vec4f(v.normal, 0.0)).xyz;
    output.uv = vec2(1.0, 1.0);
    output.entityId = u32(object.entityId);
    
    return output;
}