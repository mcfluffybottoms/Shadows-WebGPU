import * as THREE from 'three/webgpu'

export function getRenderer(): THREE.WebGPURenderer {
    const renderer = new THREE.WebGPURenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    return renderer
}

export function addObject(geometry?: THREE.BufferGeometry, material?: THREE.Material): THREE.Mesh {
    const actualGeometry = geometry || new THREE.BoxGeometry(1, 1, 1);
    const actualMaterial = material || new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(actualGeometry, actualMaterial);
    return mesh
}