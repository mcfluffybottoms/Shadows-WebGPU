struct FragmentIn {
    @location(1) fragPos: vec4<f32>,
    @location(2) fragNorm: vec3<f32>,
    @location(3) clipPos: vec4f,
    @builtin(position) Position: vec4f,
}

const RAY_NUMBER = 128;

// ----- SCENE SETUP ----- // 
@group(1) @binding(0) var<uniform> config: Config;
@group(1) @binding(1) var<storage, read> occluders: array<SphereOccluder>;
@group(1) @binding(2) var<storage, read> occludersMatrix: array<SphereOptions>;
@group(1) @binding(3) var<storage, read> occludersEntityIds: array<vec2u>;

/*
    Ambient Aperture Lighting -- Chris Oat, Pedro V. Sander
    cone-cone intersection 
*/
fn sphericalCapIntersectionApprox(
    radius1: f32,
    radius2: f32,
    dist: f32,
) -> f32 {
    var area: f32 = 0.0;

    if(dist >= radius1 + radius2) {
        return area;
    }

    area = 6.283185308 - 6.283185308 * cos(min(radius1, radius2));

    if(dist > max(radius1, radius2) - min(radius1, radius2)) {
        let diff = abs(radius1 - radius2);
        area *= smoothstep(0.0, 1.0, 1.0 - saturate((dist - diff)/(radius1 + radius2 - diff)));
    }

    return area;
}

fn ConeIntersectCone(
    direction: vec3<f32>,
    sphereCenter: vec3<f32>,
    sphereRadius: f32,
    point: vec3<f32>,
) -> f32 {
    let distVector = sphereCenter - point;
    let distance = length(distVector);
    
    let occluderAngularRadius = asin(min(1.0, sphereRadius / distance));
    
    let lightAngularRadius = config.coneAngle * DEG_TO_RAD;
    
    let distNormalized = distVector / distance;
    let dirNormalized = normalize(direction);
    let angularDistance = acos(clamp(dot(distNormalized, dirNormalized), -1.0, 1.0));
    
    return sphericalCapIntersectionApprox(
        occluderAngularRadius, 
        lightAngularRadius, 
        angularDistance
    );
}

fn ifVisible(point: vec3<f32>, direction: vec3<f32>) -> f32 {
    var visible = 1.0;
    for (var i: u32 = 0; i < arrayLength(&occluders); i++) {
        let occluderId = i;
        let occluder = occluders[occluderId];

        let scale = occludersMatrix[eid[0]].scale;
        var radius = scale * occluder.center.w;

        let blocked = ConeIntersectCone(direction,
            direction, sphereCenter, sphereRadius, point
        );
        if (blocked) {
            visible = 0.0;
            break;
        }
        
    }
    return visible;
}

// get directions to sample
// fibonacci sphere
const GOLDEN_ANGLE = PI * (3 - sqrt(5));
fn directionToSample(i: u32, n: u32) -> vec3f {
    let y = 1 - (i / (n - 1)) * 2;
    let radius = sqrt(1 - y*y);
    let angle = i * goldenAngle * 2 * PI;
    x = cos(angle) * radius;
    z = sin(angle) * radius;
    return vec3f(x, y, z);
}


@fragment
fn main(in: FragmentIn) -> vec4f {
    // light direction
    var visibleDirs: array<vec3f, RAY_NUMBER>;
    var index = 0;
    var dir = vec3f(0.0);
    for(var i = 0u; i < u32(RAY_NUMBER); i++) {
        let direction = directionToSample(i, RAY_NUMBER);
        let visible = ifVisible(in.fragPos, direction);
        if (visible == 1.0) {
            dir += direction;
            visibleDirs[index] = direction;
            index++;
        }
    }
    dir = normalize(dir);

    if (index == 0u) {
        return vec4f(0.0, 1.0, 0.0, 0.0);
    }

    var minDot = 1.0;
    for(var i = 0u; i < u32(index); i++) {
        let direction = visibleDirs[i];
        minDot = min(minDot, dot(direction, dir));
    }
    let angle = acos(clamp(minDot, -1.0, 1.0));
    
    return vec4f(dir, angle);
}