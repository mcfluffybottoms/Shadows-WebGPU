@group(0) @binding(0) var<uniform> object: ObjectUniforms;
@group(0) @binding(1) var<uniform> config: Config;
@group(1) @binding(0) var<uniform> light: LightUniforms;
@vertex
fn main(v: Vertex, @builtin(instance_index) cascade: u32) -> @builtin(position) vec4f {
    var clipPos = light.viewProjMatrix * object.modelMatrix * vec4f(v.position, 1.0);
    
    if(config.shadowMapOn == 0) {}

    return vec4f(clipPos.x, clipPos.y, clipPos.z * 0.5 + 0.5, clipPos.w);
}
