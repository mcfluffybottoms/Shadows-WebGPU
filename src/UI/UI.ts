import { addCamera, CameraType } from "../camera";


export function changeCameraType() {
    const cameraTypeSelect = document.getElementById('cameraType') as HTMLSelectElement;
    const type = cameraTypeSelect.value == "0" ? CameraType.Orthographic : CameraType.Perspective;
    return addCamera(type);
}

// document.getElementById('cameraType')?.addEventListener('change', () => {
//     const pos =  camera.position;
//     const rot = camera.rotation;
//     const target = controls.target;
//     camera = changeCamera();
//     camera.position.set(pos.x, pos.y, pos.z);
//     camera.rotation.set(rot.x, rot.y, rot.z, rot.order);
//     controls = setupControls(camera, renderer);
//     controls.target.copy(target);
// });