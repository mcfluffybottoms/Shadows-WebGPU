@vertex
fn main(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) 
    -> @builtin(position) vec4f {
    
    // Positions for two squares (first at (0,0), second at (-1,-1))
    const positions = array(
        // First square (top-right)
        vec2f(0, 0), vec2f(0, 1), vec2f(1, 0),
        vec2f(1, 0), vec2f(0, 1), vec2f(1, 1),
        // Second square (bottom-left)
        vec2f(-1, -1), vec2f(-1, 0), vec2f(0, -1),
        vec2f(0, -1), vec2f(-1, 0), vec2f(0, 0),
        // Third square (top-left)
        vec2f(-1, 1), vec2f(0, 1), vec2f(-1, 0),
        vec2f(-1, 0), vec2f(0, 1), vec2f(0, 0),
        // Forth square (bottom-right)
        vec2f(0, 0), vec2f(1, 0), vec2f(0, -1),
        vec2f(0, -1), vec2f(1, 0), vec2f(1, -1)
    );
    
    return vec4f(positions[vi + ii * 6], 0.0, 1.0);
}