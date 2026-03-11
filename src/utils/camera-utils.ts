import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three/webgpu'
import { webGPUData } from './webgpu-data';
import { DEG2RAD } from 'three/src/math/MathUtils.js';

// ------------- CONTROLS AND CAMERAS FROM THREE JS ------------- //

export enum CameraType {
    Orthographic,
    Perspective
}

export type CameraConfig = {
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  controls: OrbitControls
}

export function addCamera(canvas: HTMLCanvasElement, type: CameraType): THREE.OrthographicCamera | THREE.PerspectiveCamera {
    var camera;
    const aspect = canvas.width / canvas.height;
    const scaleFactor = 200;
    if (type == CameraType.Orthographic) {
        camera = new THREE.OrthographicCamera(
            -canvas.width / scaleFactor,
            canvas.width / scaleFactor,
            canvas.height / scaleFactor,
            -canvas.height / scaleFactor,
            -1500,
            1500);
        camera.position.set(0, 0, 0);
    } else {
        camera = new THREE.PerspectiveCamera(
            70,
            aspect,
            0.1,
            100
        );

    }
    camera.position.set(17.733736277643853, 1.8645731021897773, -11.723682572752207);
    camera.rotation.set(-2.907098534188704, 0.862378271482270, 2.9621339797774384);
    return camera
}

// ------ view-projection matrix ------ //
export function setControls(canvas: HTMLCanvasElement, camera: THREE.Camera) {
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.update();
  return controls;
}

// ------ view-projection matrix ------ //

export function getVP(camera: THREE.Camera): THREE.Matrix4 {
    camera.updateMatrixWorld(true);
    const lightViewMatrix = camera.matrixWorldInverse;
    const lightProjMatrix = camera.projectionMatrix.clone();

    const lightViewProjMatrix = new THREE.Matrix4()
        .multiplyMatrices(lightProjMatrix, lightViewMatrix);

    return lightViewProjMatrix;
}

export function getVPraw(projMatrix: THREE.Matrix4, viewMatrix: THREE.Matrix4): THREE.Matrix4 {
    const lightViewProjMatrix = new THREE.Matrix4()
        .multiplyMatrices(projMatrix, viewMatrix);

    return lightViewProjMatrix;
}

export function getInverseVP(camera: THREE.Camera): THREE.Matrix4 {
    return getVP(camera).invert();
}

export function changeProjectionMatrix(
    camera: THREE.OrthographicCamera,
    left: number, right: number,
    top: number, bottom: number,
    near: number, far: number) {
    camera.left = left;
    camera.right = right;
    camera.top = top;
    camera.bottom = bottom;
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
}


export function getProjMatrix(camera: THREE.OrthographicCamera | THREE.PerspectiveCamera, zNear?: number, zFar?: number): THREE.Matrix4 {
    var projMatrix;

    if(zNear == undefined) {
        zNear = camera.near;
    }
    if(zFar == undefined) {
        zFar = camera.far;
    }

    if (camera instanceof THREE.OrthographicCamera) {
        const near = zNear;
        const far = zFar;
        const dx = (camera.right - camera.left) / (2 * camera.zoom);
        const dy = (camera.top - camera.bottom) / (2 * camera.zoom);
        const cx = (camera.right + camera.left) / 2;
        const cy = (camera.top + camera.bottom) / 2;

        let left = cx - dx;
        let right = cx + dx;
        let top = cy + dy;
        let bottom = cy - dy;

        if (camera.view !== null && camera.view.enabled) {
            const scaleW = (camera.right - camera.left) / camera.view.fullWidth / camera.zoom;
            const scaleH = (camera.top - camera.bottom) / camera.view.fullHeight / camera.zoom;
            left += scaleW * camera.view.offsetX;
            right = left + scaleW * camera.view.width;
            top -= scaleH * camera.view.offsetY;
            bottom = top - scaleH * camera.view.height;
        }

        projMatrix = new THREE.Matrix4().makeOrthographic(left, right, top, bottom, near, far, camera.coordinateSystem, camera.reversedDepth);
    } else {
        const near = zNear;
        const far = zFar;
        let top = near * Math.tan(DEG2RAD * 0.5 * camera.fov) / camera.zoom;
        let height = 2 * top;
        let width = camera.aspect * height;
        let left = - 0.5 * width;

        if (camera.view !== null && camera.view.enabled) {
            const fullWidth = camera.view.fullWidth, fullHeight = camera.view.fullHeight;
            left += camera.view.offsetX * width / fullWidth;
            top -= camera.view.offsetY * height / fullHeight;
            width *= camera.view.width / fullWidth;
            height *= camera.view.height / fullHeight;
        }

        const skew = camera.filmOffset;
        if (skew !== 0) left += near * skew / camera.getFilmWidth();

        projMatrix = new THREE.Matrix4().makePerspective(left, left + width, top, top - height, near, far, camera.coordinateSystem, camera.reversedDepth);
    }

    return projMatrix;
}