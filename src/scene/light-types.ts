import * as THREE from "three/webgpu";
import { webGPUData } from "../utils/webgpu-data";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { bool } from "three/tsl";
import { changeProjectionMatrix, getInverseVP, getProjMatrix, getVP, getVPraw } from "../utils/camera-utils";
import { DEG2RAD } from "three/src/math/MathUtils.js";

export interface LightSource {
    projMatrix: THREE.Matrix4;
    viewMatrix: THREE.Matrix4;
    viewProjMatrix?: THREE.Matrix4[];
    update(camera: THREE.OrthographicCamera | THREE.PerspectiveCamera, zNear: number, zFar: number, numOfCascades: number) : void;
};

export type Split = {
    near: number,
    far: number
}

export class DirectionalLight implements LightSource {
    constructor(camera: THREE.OrthographicCamera | THREE.PerspectiveCamera, numOfCascades: number) {
        this.upVector = new THREE.Vector3(0, 1, 0);
        this.projMatrix = new THREE.Matrix4;
        this.viewMatrix = new THREE.Matrix4;
        
        this.direction = new THREE.Vector3(1.0, 0.5, -0.5).normalize();
        this.splits = [];

        this.numOfCascades = numOfCascades + 1;
        this.viewProjMatrix = [];
        this.setViewProjMatrixSize(numOfCascades);
    
        this.update(camera, numOfCascades, 1024);
    }

    private setViewProjMatrixSize(numOfCascades: number) {
        if(this.numOfCascades == numOfCascades) return;
        this.numOfCascades = numOfCascades;
        this.viewProjMatrix = [];
        for(var i = 0; i < numOfCascades; ++i) {
            this.viewProjMatrix.push(new THREE.Matrix4);
        }
        this.splits = [];
        for(var i = 0; i < numOfCascades; ++i) {
            this.splits.push({
                near: 1,
                far: 1
            });
        }
    }

    private updateViewProjMatrix(corners: THREE.Vector4[], shadowMapResolution: number) {
        const center = corners.reduce(
            (acc: THREE.Vector3, c: THREE.Vector4) => { return acc.add(new THREE.Vector3(c.x, c.y, c.z)); },
            new THREE.Vector3(0, 0, 0)
        ).divideScalar(corners.length);

        let radius = 0;
        for (const c of corners) {
            const v = new THREE.Vector3(c.x, c.y, c.z);
            radius = Math.max(radius, v.distanceTo(center));
        }

        this.viewMatrix.lookAt(center, center.clone().sub(this.direction.clone().multiplyScalar(radius * 2.0)), this.upVector);
        
        const box = corners.reduce(
            (box, corner) => {
                const view = corner.clone().applyMatrix4(this.viewMatrix);
                return {
                    min: {
                        x: Math.min(box.min.x, view.x),
                        y: Math.min(box.min.y, view.y),
                        z: Math.min(box.min.z, view.z)
                    },
                    max: {
                        x: Math.max(box.max.x, view.x),
                        y: Math.max(box.max.y, view.y),
                        z: Math.max(box.max.z, view.z)
                    }
                }
            },
            {
                min: { x: Infinity, y: Infinity, z: Infinity },
                max: { x: -Infinity, y: -Infinity, z: -Infinity }
            }
        );

        const zMult = 5.0;
        if(box.min.z < 0) {
            box.min.z *= zMult;
        } else {
            box.min.z /= zMult;
        }
        if(box.max.z < 0) {
            box.max.z /= zMult;
        } else {
            box.max.z *= zMult;
        }

        const worldUnitsPerTexel = (box.max.x - box.min.x) / shadowMapResolution;

        box.min.x = Math.floor(box.min.x / worldUnitsPerTexel) * worldUnitsPerTexel;
        box.min.y = Math.floor(box.min.y / worldUnitsPerTexel) * worldUnitsPerTexel;
        box.max.x = Math.floor(box.max.x / worldUnitsPerTexel) * worldUnitsPerTexel;
        box.max.y = Math.floor(box.max.y / worldUnitsPerTexel) * worldUnitsPerTexel;
        this.projMatrix = this.projMatrix.makeOrthographic(
            box.min.x, box.max.x,
            box.max.y, box.min.y,
            box.min.z - 100, box.max.z + 100
        );
    }

    public update(camera: THREE.OrthographicCamera | THREE.PerspectiveCamera, numOfCascades: number, shadowMapResolution: number) {
        this.setViewProjMatrixSize(numOfCascades);
        
        for(var i = 0; i < numOfCascades; ++i) {
            const range = camera.far - camera.near;
            const zNear = camera.near + range * (i / numOfCascades);
            const zFar  = camera.near + range * ((i + 1) / numOfCascades);
            this.splits[i] = {
                near: zNear,
                far: zFar
            };
            camera.updateMatrixWorld();
            const projMatrix = getProjMatrix(camera, zNear, zFar);
            const corners = getFrustumCorners(projMatrix, camera.matrixWorldInverse);
            this.updateViewProjMatrix(corners, shadowMapResolution);
            this.viewProjMatrix[i] = getVPraw(this.projMatrix, this.viewMatrix);
        }
    }

    direction: THREE.Vector3;
    projMatrix: THREE.Matrix4;
    viewMatrix: THREE.Matrix4;
    viewProjMatrix: THREE.Matrix4[];
    splits: Split[];
    upVector: THREE.Vector3;

    numOfCascades: number;
};
// ------ GENERATING VP FOR CASCADED SHADOWS ------ //

export function getFrustumCorners(projMatrix: THREE.Matrix4, viewMatrix: THREE.Matrix4) {
    const inv = getVPraw(projMatrix, viewMatrix).invert();
    const corners: THREE.Vector4[] = [];

    for (var x = -1; x <= 1; ++x) {
        for (var y = -1; y <= 1; ++y) {
            for (var z = -1; z <= 1; ++z) {
                const ndcPoint = new THREE.Vector4(x, y, z, 1.0);
                const worldPoint = ndcPoint.applyMatrix4(inv);
                corners.push(worldPoint.divideScalar(worldPoint.w));
            }
        }
    }
    return corners;
}

export class LightControls {
    constructor(canvas: HTMLCanvasElement, light: DirectionalLight) {
        // this.controls = new OrbitControls(light.camera, canvas);
        // this.controls.target.set(0, 0, 0);
        // this.controls.enableRotate = true;
        // this.controls.enableZoom = true;
        // this.controls.enablePan = true;
        // this.controls.update();
        // this.controls.disconnect();

        // this.light = light;
    }
    public update(deltaTime?: number | null): boolean {
        // const updated = this.controls.update(deltaTime);
        // if (updated) {
        //     this.light.updateLight();
        //     this.light.changeCamera(corners);
        // }
        // return updated;
        return false;
    }

    public connect(canvas: HTMLCanvasElement) {
        // console.log(this.controls.target);
        // this.controls.connect(canvas);

    }
    public disconnect() {
        // this.controls.disconnect();
    }
    // controls: OrbitControls;
    // light: DirectionalLight;
}
