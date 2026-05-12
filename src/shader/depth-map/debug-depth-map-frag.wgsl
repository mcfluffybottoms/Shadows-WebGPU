@group(0) @binding(0) var depthTex: texture_depth_2d;
@group(0) @binding(1) var depthSampler: sampler;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    var color: vec4f;
    let uv = pos.xy / vec2f(1024, 1024);
    let depthValue = textureSample(depthTex, depthSampler, uv);
    color = vec4f(depthValue, depthValue, depthValue, 1.0);
    return color;
}