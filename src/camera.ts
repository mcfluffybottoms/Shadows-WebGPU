import * as THREE from 'three/webgpu'

export function addCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    return camera
}

export function makeDraggable(camera: THREE.PerspectiveCamera) {
    let isDragging = false;
    let shiftX = 0;
    let shiftY = 0;

    const onMouseDown = (e: MouseEvent) => {
        isDragging = true;
        shiftX = e.clientX - document.body.getBoundingClientRect().left;
        shiftY = e.clientY - document.body.getBoundingClientRect().top;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        const moveX = (e.pageX - shiftX);
        const moveY = (e.pageY - shiftY);
        moveCamera(camera, moveX, moveY);
    };

    const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousedown', onMouseDown);
}


export function moveCamera(
    camera: THREE.PerspectiveCamera, 
    targetX: number, 
    targetY: number,
    speed: number = 0.1
): THREE.PerspectiveCamera {
    camera.position.x -= targetX * speed;
    camera.position.y += targetY * speed;
    return camera
}

export function turnCamera(camera: THREE.PerspectiveCamera, x: number, y:number) {
    camera.rotation.x +=x;
    camera.rotation.y +=y;
    return camera
}

export function zoomCamera(camera: THREE.PerspectiveCamera, z: number) {
    camera.position.z +=z;
    return camera
}