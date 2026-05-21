struct VertexOut {
    @location(1) fragPos: vec4<f32>,
    @location(2) fragNorm: vec3<f32>,
    @location(3) clipPos: vec4f,
    @builtin(position) Position: vec4f,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;
@group(0) @binding(1) var<uniform> object: ObjectUniforms;

@vertex
fn main(v: Vertex) -> VertexOut {
    let worldPos = object.modelMatrix * vec4f(v.position, 1.0);

    // to output
    var output = VertexOut(
        worldPos,
        (object.normalMatrix * vec4f(v.normal, 0.0)).xyz,
        camera.viewProjMatrix * worldPos,
        camera.viewProjMatrix * worldPos
    );

    return output;
}