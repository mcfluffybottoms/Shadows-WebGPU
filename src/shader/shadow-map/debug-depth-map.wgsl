// struct LightUniforms {
//     viewProjMatrix: mat4x4<f32>,
// };
// struct ObjectUniforms {
//     modelMatrix : mat4x4<f32>,
// };

// struct Vertex {
//     @location(0) position: vec3<f32>,
//     @location(1) normal: vec3<f32>,
// };

// @group(0) @binding(2) var<uniform> light: LightUniforms;
// @group(0) @binding(3) var<uniform> object : ObjectUniforms;

// @vertex
// fn main(v: Vertex) -> @builtin(position) vec4f {
//     return light.viewProjMatrix * object.modelMatrix * vec4f(v.position, 1.0);
// }


@vertex
fn main(@builtin(vertex_index) vi : u32) -> @builtin(position) vec4f {
    const pos = array(
        vec2f(-1, -1), vec2f(-1, 1), vec2f(1, -1),
        vec2f(1, -1), vec2f(-1, 1), vec2f(1, 1)
    );
    //const sss = light.viewProjMatrix;
    return  vec4f(pos[vi], 0, 1);
}