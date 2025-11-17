import * as THREE from 'three/webgpu'

export function addCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    return camera
}

export function makeDraggable(camera: THREE.PerspectiveCamera) {
    let isDragging = false;
    let shiftX = 0;
    let shiftY = 0;
    let lastMousePosX = 0;
    let lastMousePosY = 0;
    let dragStartPosition = new THREE.Vector3();

    const onMouseDown = (e: MouseEvent) => {
        isDragging = true;
        lastMousePosX = e.screenX;
        lastMousePosY = e.screenY;
        dragStartPosition.copy(camera.position);

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        const moveX = e.screenX;
        const moveY = e.screenY;
        moveCamera(camera, moveX, moveY, lastMousePosX, lastMousePosY, dragStartPosition);
    };

    const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousedown', onMouseDown);
}

export function getWorldCoord(
    camera: THREE.PerspectiveCamera,
    screenX: number,
    screenY: number,
    distance: number,
): THREE.Vector3 {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const nx = 2.0 * screenX / width - 1.0;
    const ny = 1.0 - 2.0 * screenY / height;
    const projectionMatrix = camera.projectionMatrix.elements;
    const X_NDC = 2.0 * distance / projectionMatrix[0];  // projection_(0, 0)
    const Y_NDC = 2.0 * distance / projectionMatrix[5];  // projection_(1, 1)
    
    const wx = nx * X_NDC + camera.position.x;
    const wy = ny * Y_NDC + camera.position.y;
    const wz = camera.position.z - distance;
    
    return new THREE.Vector3(wx, wy, wz);
}

export function moveCamera(
    camera: THREE.PerspectiveCamera,
    targetX: number,
    targetY: number,
    lastTargetX: number,
    lastTargetY: number,
    dragStartPosition: THREE.Vector3,
    speed: number = 0.1
): THREE.PerspectiveCamera {

    const currentWorld = getWorldCoord(camera, targetX, targetY, 1);
    const startWorld = getWorldCoord(camera, lastTargetX, lastTargetY, 1);
    const delta = new THREE.Vector3().subVectors(startWorld, currentWorld);
    camera.position.set(
        dragStartPosition.x + delta.x,
        dragStartPosition.y + delta.y,
        dragStartPosition.z + delta.z
    );
    camera.updateProjectionMatrix();
    return camera
}

export function turnCamera(camera: THREE.PerspectiveCamera, x: number, y: number) {
    camera.rotation.x += x;
    camera.rotation.y += y;
    return camera
}

export function zoomCamera(camera: THREE.PerspectiveCamera, z: number) {
    camera.position.z += z;
    return camera
}