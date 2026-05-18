import * as THREE from 'three/webgpu';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


// ---------------------------------------------------
// Scene
// ---------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202533);


// ---------------------------------------------------
// Camera
// ---------------------------------------------------

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 4, 12);


// ---------------------------------------------------
// Renderer
// ---------------------------------------------------

const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.shadowMap.enabled = true;

document.body.appendChild(renderer.domElement);


// ---------------------------------------------------
// Controls
// ---------------------------------------------------

const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;


// ---------------------------------------------------
// Lights
// ---------------------------------------------------
const ambientLight = new THREE.AmbientLight(0x000000, 0.1);
scene.add(ambientLight);

const lights = [
    { color: 0xffffff, intensity: 1, pos: [-0.75, 0.5, 1], radius: 8, samples: 16 },
    { color: 0xffffff, intensity: 1, pos: [-1, 0.5, 1], radius: 8, samples: 16 },
    { color: 0xffffff, intensity: 1, pos: [-0.5, 0.1, 0.5], radius: 16, samples: 16 },
    { color: 0xffffff, intensity: 1, pos: [-1.0, 0.8, 1.0], radius: 16, samples: 16 },
    //{ color: 0xffffff, intensity: 1, pos: [-1.0, 0.5, 0.5], radius: 8, samples: 16 },
    //{ color: 0xffffff, intensity: 1, pos: [-1.0, 0.1, 0.5], radius: 17, samples: 16 }
];

lights.forEach(lightConfig => {
    const light = new THREE.DirectionalLight(lightConfig.color, lightConfig.intensity);
    light.position.set(...lightConfig.pos);
    light.castShadow = true;
    light.shadow.radius = lightConfig.radius;
    light.shadow.blurSamples = lightConfig.samples; // Reduced from 150!
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    
    // Important: Set shadow camera bounds to prevent clipping
    light.shadow.camera.near = -50;
    light.shadow.camera.far = 50;
    light.shadow.camera.left = -30;
    light.shadow.camera.right = 30;
    light.shadow.camera.top = 25;
    light.shadow.camera.bottom = -25;
    
    scene.add(light);
});
// ---------------------------------------------------
// Ground
// ---------------------------------------------------

const groundGeometry = new THREE.PlaneGeometry(50, 50);

const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0xE5E5E5
});

const ground = new THREE.Mesh(groundGeometry, groundMaterial);

ground.rotation.x = -Math.PI / 2;

ground.receiveShadow = true;

scene.add(ground);


// ---------------------------------------------------
// GLTF Loader
// ---------------------------------------------------

const loader = new GLTFLoader();

function setGrayMaterial(material) {
  material.color.setRGB(0.9, 0.9, 0.9);
  material.emissive?.setRGB(0, 0, 0);
  material.opacity = 1.0;
  material.transparent = false;
}
// ---------------------------------------------------
// MODEL 1 - Helmet
// ---------------------------------------------------

loader.load(
  '/assets/low_poly_car copy 2.glb',

  (gltf) => {

    const model = gltf.scene;

    model.position.set(-4, 0, 0);

    model.scale.set(0.005, 0.005, 0.005);

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        if (child.material) {
          // Handle single material or array of materials
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => setGrayMaterial(mat));
          } else {
            setGrayMaterial(child.material);
          }
        }
      }
    });

    scene.add(model);
  }
);


// ---------------------------------------------------
// MODEL 2
// ---------------------------------------------------

loader.load(
  '/assets/low_poly_car copy.glb',

  (gltf) => {

    const model = gltf.scene;

    model.position.set(0, 0, 0);
    model.rotation.set(0.0, -Math.PI / 2, 0.0);
    model.scale.set(0.005, 0.005, 0.005);

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        if (child.material) {
          // Handle single material or array of materials
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => setGrayMaterial(mat));
          } else {
            setGrayMaterial(child.material);
          }
        }
      }
    });

    scene.add(model);
  }
);


// ---------------------------------------------------
// MODEL 3 - Horse
// ---------------------------------------------------

loader.load(
  '/assets/low_poly_car.glb',

  (gltf) => {

    const model = gltf.scene;

    model.position.set(4, 0, 0);
    model.rotation.set(0.0, Math.PI / 4, 0.0);
    model.scale.set(0.005, 0.005, 0.005);

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        if (child.material) {
          // Handle single material or array of materials
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => setGrayMaterial(mat));
          } else {
            setGrayMaterial(child.material);
          }
        }
      }
    });


    scene.add(model);
  }
);

import {getWebGPUMemoryUsage} from 'https://greggman.github.io/webgpu-memory/dist/1.x/webgpu-memory.module.js';

// ---------------------------------------------------
// Animation Loop
// ---------------------------------------------------
let measured = 0;
let allTime = 0;
function animate() {
  const startTime = performance.now();
  requestAnimationFrame(animate);
  measured
  controls.update();

  const elapsedMs = performance.now() - startTime;
  allTime += elapsedMs;
  measured++;

  if(measured > 100) {
    console.log(measured / 100)
    measured = 0;
  }
  const info = getWebGPUMemoryUsage();

  console.log(info)
  renderer.render(scene, camera);
}

animate();


// ---------------------------------------------------
// Resize
// ---------------------------------------------------

window.addEventListener('resize', () => {

  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});