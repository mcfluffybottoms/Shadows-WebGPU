import * as THREE from "three/webgpu";

import { getProjMatrix, getVPraw } from "../utils/camera-utils";

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

const _origin = new THREE.Vector3( 0, 0, 0 );

export class DirectionalLight implements LightSource {
    private numOfCascades: number;
    private upVector: THREE.Vector3;
    direction: THREE.Vector3;
    projMatrix: THREE.Matrix4;
    splits: Split[];
    viewMatrix: THREE.Matrix4;
    viewProjMatrix: THREE.Matrix4[];

    constructor(camera: THREE.OrthographicCamera | THREE.PerspectiveCamera, numOfCascades: number) {
        this.upVector = new THREE.Vector3(0, 1, 0);
        this.projMatrix = new THREE.Matrix4;
        this.viewMatrix = new THREE.Matrix4;
        
        this.direction = new THREE.Vector3(1.0, 0.5, -0.5).normalize();
        this.splits = [];

        this.numOfCascades = 0;
        this.viewProjMatrix = [];
        this.setViewProjMatrixSize(0);
    
        this.update(camera, numOfCascades, 1024, 0.5);
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

    private updateViewProjMatrix(
        camera: THREE.OrthographicCamera | THREE.PerspectiveCamera, 
        corners: THREE.Vector4[], 
        shadowMapResolution: number
    ) {       
        // texel snapping
        let texelWidth: number;
        let texelHeight: number;
        if (camera instanceof THREE.OrthographicCamera) {
            texelWidth = (camera.right - camera.left) / shadowMapResolution;
            texelHeight = (camera.top - camera.bottom) / shadowMapResolution;
        } else {
            const tanFOV = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
            const farHeight = tanFOV * camera.far * 2;
            const farWidth = farHeight * camera.aspect;
            texelWidth = farWidth / shadowMapResolution;
            texelHeight = farHeight / shadowMapResolution;
        }


        // get view matrix
        const center = getFrustumCenter(corners);
        const radius = getFrustumRadius(corners, center) + 20;
        const viewPos = center.clone().add(this.direction.clone());
        this.viewMatrix.lookAt(viewPos, center, this.upVector);
        center.applyMatrix4(this.viewMatrix);

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

        box.min.x = Math.floor(box.min.x / texelWidth) * texelWidth;
        box.min.y = Math.floor(box.min.y / texelHeight) * texelHeight;
        box.max.x = Math.floor(box.max.x / texelWidth) * texelWidth;
        box.max.y = Math.floor(box.max.y / texelHeight) * texelHeight;

        this.projMatrix = this.projMatrix.makeOrthographic(
            box.min.x, box.max.x,
            box.max.y, box.min.y,
            box.min.z - radius, box.max.z + radius
        );
    }

    public update(camera: THREE.OrthographicCamera | THREE.PerspectiveCamera, numOfCascades: number, shadowMapResolution: number, lambda: number) {
        this.setViewProjMatrixSize(numOfCascades);

        for(var i = 0; i < numOfCascades; ++i) {
            const zFar = getSplit(camera.near, camera.far, i, numOfCascades, lambda);
            this.splits[i] = {
                near: camera.near,
                far: zFar
            };
            camera.updateMatrixWorld();
            const projMatrix = getProjMatrix(camera, camera.near, zFar);
            const corners = getFrustumCorners(projMatrix, camera.matrixWorldInverse);
            this.updateViewProjMatrix(camera, corners, shadowMapResolution);
            this.viewProjMatrix[i] = getVPraw(this.projMatrix, this.viewMatrix);
        }
    }
};
// ------ GENERATING VP FOR CASCADED SHADOWS ------ //

function getFrustumCorners(projMatrix: THREE.Matrix4, viewMatrix: THREE.Matrix4) {
    const inv = getVPraw(projMatrix, viewMatrix).invert();
    const corners: THREE.Vector4[] = [];

    for (var x = -1; x <= 1; x = x + 1) {
        for (var y = -1; y <= 1; y = y + 1) {
            for (var z = -1; z <= 1; z = z + 1) {
                const ndcPoint = new THREE.Vector4(x, y, z, 1.0);
                const worldPoint = ndcPoint.applyMatrix4(inv);
                corners.push(worldPoint.divideScalar(worldPoint.w));
            }
        }
    }
    return corners;
}

function getFrustumCenter(corners: THREE.Vector4[]) {
    return corners.reduce(
        (acc: THREE.Vector3, c: THREE.Vector4) => { 
            return acc.add(new THREE.Vector3(c.x, c.y, c.z)); 
        },
        new THREE.Vector3(0, 0, 0)
    ).divideScalar(corners.length);
}

function getFrustumRadius(corners: THREE.Vector4[], center: THREE.Vector3) {
    let radius = 0;
    for (const c of corners) {
        const v = new THREE.Vector3(c.x, c.y, c.z);
        radius = Math.max(radius, v.distanceTo(center));
    }
    return radius;
}

function getSplit(near: number, far: number, cascadeNumber: number, numOfCascades: number, lambda: number) {
    const range = far - near;
    const log = near * Math.pow(far / near, (cascadeNumber + 1) / numOfCascades);
    const uniform = near + range * ((cascadeNumber + 1) / numOfCascades);
    const splitDist = lambda * log + (1 - lambda) * uniform;
    return splitDist;
}

