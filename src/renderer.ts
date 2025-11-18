import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

export function getRenderer(): THREE.WebGPURenderer {
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  return renderer;
}

export function loadMeshFromLink(path: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new OBJLoader();
    loader.load(
      path,
      (root) => {
        console.log("Children:", root.children);
        root.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshBasicMaterial({ color: 0x2f4f4f });
          }
        });
        resolve(root);
      },
      undefined,
      reject
    );
  });
}

export async function loadAndAddObject(path: string, scene: THREE.Scene) {
  try {
    const loadedGroup = await loadMeshFromLink(path);
    scene.add(loadedGroup);
    return loadedGroup;
  } catch (error) {
    console.error("Failed to load model:", error);
  }
}
