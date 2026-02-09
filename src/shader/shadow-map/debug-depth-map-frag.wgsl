@group(0) @binding(0) var depthTex: texture_depth_2d;
@group(0) @binding(1) var depthSampler: sampler;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let depth = textureSample(depthTex, depthSampler, pos.xy / vec2f(1024, 1024));
    return vec4f(vec3(depth), 1);
}