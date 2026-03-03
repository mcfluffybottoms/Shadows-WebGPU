import { cameraWhat, controllingWhat, renderWhat, UI, UIchanged } from "./UIcontroller";

function hideDivElementById(shouldHide: boolean, id: string) {
    let htmlElement = document.getElementById(id);
    if (htmlElement) {
        htmlElement.style.display = shouldHide ? "none" : "block";
    } else {
        console.error("Element with id '" + id + "' not found.");
    }
}
export function initUInteractions(): void {
    (document.getElementById('changePos') as HTMLSelectElement).value = '0';
    (document.getElementById('render') as HTMLSelectElement).value = '0';
    (document.getElementById('cameraType') as HTMLSelectElement).value = '0';
    (document.getElementById('shadowMapOn') as HTMLInputElement).checked = true;
    (document.getElementById('numberOfSamples') as HTMLInputElement).value = UI.numberOfSamples.toString();
    (document.getElementById('depthPassSize') as HTMLInputElement).value = UI.depthPassSize.toString();
    (document.getElementById('numberOfCascades') as HTMLInputElement).value = UI.numOfCascades.toString();
    (document.getElementById('shadowMapOn') as HTMLInputElement).checked = true;

    hideDivElementById(UI.shadowMap, "depthMapSettings");
    let htmlElement = document.getElementById('depthCascade') as HTMLInputElement;
    htmlElement.max = UI.numOfCascades.toString();
    htmlElement.value = "1";
    UI.depthMapCascade = 1;

    // change controls
    document.getElementById('changePos')?.addEventListener('change', () => {
        const controlsSelect = document.getElementById('changePos') as HTMLSelectElement;
        UI.controllingWhat = controlsSelect.value == "0" ? controllingWhat.camera : controllingWhat.light;
        UIchanged.controllingWhat = true;
    });

    // change view - render depth pass or shadow maps
    document.getElementById('render')?.addEventListener('change', () => {
        const renderSelect = document.getElementById('render') as HTMLSelectElement;
        UI.renderWhat = renderSelect.value == "0" ? renderWhat.scene : renderWhat.depthMap;
        hideDivElementById(UI.renderWhat == renderWhat.scene, "depthMapSettings");
    });

    // change view - render depth pass or shadow maps
    document.getElementById('cameraType')?.addEventListener('change', () => {
        const cameraSelect = document.getElementById('cameraType') as HTMLSelectElement;
        UI.cameraWhat = cameraSelect.value == "0" ? cameraWhat.Perspective : cameraWhat.Orthographic;
        UIchanged.cameraWhat = true;
    });

    // change shadow map on/off
    document.getElementById('shadowMapOn')?.addEventListener('change', () => {
        const shadowMapCheckbox = document.getElementById('shadowMapOn') as HTMLInputElement;
        UI.shadowMap = shadowMapCheckbox.checked;
        UIchanged.configChanged = true;
    });

    // change depth map cascade
    document.getElementById('depthCascade')?.addEventListener('change', () => {
        const samplesInput = document.getElementById('depthCascade') as HTMLInputElement;
        UI.depthMapCascade = samplesInput.valueAsNumber;
        UIchanged.configChanged = true;
    });

    // change samples
    document.getElementById('numberOfSamples')?.addEventListener('change', () => {
        const samplesInput = document.getElementById('numberOfSamples') as HTMLInputElement;
        UI.numberOfSamples = samplesInput.valueAsNumber;
        UIchanged.configChanged = true;
    });

    // change number of cascades
    document.getElementById('numberOfCascades')?.addEventListener('change', () => {
        const samplesInput = document.getElementById('numberOfCascades') as HTMLInputElement;
        UI.numOfCascades = samplesInput.valueAsNumber;
        UIchanged.configChanged = true;

        // get new max and value
        let htmlElement = document.getElementById('depthCascade') as HTMLInputElement;
        htmlElement.max = UI.numOfCascades.toString();
        htmlElement.value = "1";
        UI.depthMapCascade = 1;
    });

    // change depth pass size
    document.getElementById('depthPassSize')?.addEventListener('change', () => {
        const sizeInput = document.getElementById('depthPassSize') as HTMLInputElement;
        UI.depthPassSize = sizeInput.valueAsNumber;
        UIchanged.depthPassSizeChanged = true;
    });

}

export function changeFPS(fps: number) {
    var fpsElement = document.getElementById('fps-counter');
    if (!fpsElement) {
        console.warn('FPS counter element not found');
        return;
    }
    fpsElement.textContent = "FPS: " + fps.toString();
}

export function changeMPF(minMpf: number, avgMpf: number, maxMpf: number) {
    var mpfElement = document.getElementById('mpf-counter');
    if (!mpfElement) {
        console.warn('MPF counter element not found');
        return;
    }
    mpfElement.textContent = 
        "MIN MPF: " + (Math.round(minMpf * 100) / 100).toFixed(2).toString() + " | " + 
        "AVG MPF: " + (Math.round(avgMpf * 100) / 100).toFixed(2).toString() + " | " + 
        "MAX MPF: " + (Math.round(maxMpf * 100) / 100).toFixed(2).toString();
}