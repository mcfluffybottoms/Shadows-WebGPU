import { cameraWhat, renderWhat, UI, UIFlags } from "./UI-flags-types";

function hideDivElementById(shouldHide: boolean, id: string) {
    let htmlElement = document.getElementById(id);
    if (htmlElement) {
        htmlElement.style.display = shouldHide ? "none" : "block";
    } else {
        console.error("Element with id '" + id + "' not found.");
    }
}
export function initUInteractions(): void {
    (document.getElementById('render') as HTMLSelectElement).value = '0';
    (document.getElementById('cameraType') as HTMLSelectElement).value = '0';
    (document.getElementById('shadowMapOn') as HTMLInputElement).checked = false;
    (document.getElementById('numberOfSamples') as HTMLInputElement).value = UI.numberOfSamples.toString();
    (document.getElementById('depthPassSize') as HTMLInputElement).value = UI.depthPassSize.toString();
    (document.getElementById('numberOfCascades') as HTMLInputElement).value = UI.numOfCascades.toString();

    (document.getElementById('dirx') as HTMLSelectElement).value = UI.direction.x.toString();
    (document.getElementById('diry') as HTMLSelectElement).value = UI.direction.y.toString();
    (document.getElementById('dirz') as HTMLSelectElement).value = UI.direction.z.toString();

    (document.getElementById('biasValue') as HTMLSelectElement).value = UI.biasValue.toString();

    (document.getElementById('lightOn') as HTMLInputElement).checked = UI.lightOn;
    (document.getElementById('cascadeLayers') as HTMLInputElement).checked = UI.cascadeLayers;
    (document.getElementById('lightAmbient') as HTMLInputElement).value = UI.lightAmbient.toString();

    (document.getElementById('lambda') as HTMLInputElement).value = UI.lambda.toString();

    (document.getElementById('coneAngle') as HTMLInputElement).value = UI.coneAngle.toString();
    (document.getElementById('hemisphereRadius') as HTMLInputElement).value = UI.hemisphereRadius.toString();

    (document.getElementById('dirStrength') as HTMLInputElement).value = UI.dirStrength.toString();
    (document.getElementById('ambStrength') as HTMLInputElement).value = UI.ambStrength.toString();
    (document.getElementById('tilesX') as HTMLInputElement).value = UI.tilesX.toString();
    (document.getElementById('tilesY') as HTMLInputElement).value = UI.tilesY.toString();
    (document.getElementById('seeGrid') as HTMLInputElement).checked = false;
    (document.getElementById('directionalOn') as HTMLInputElement).checked = true;
    (document.getElementById('ambientOn') as HTMLInputElement).checked = true;
    (document.getElementById('AnalyticShadowsOn') as HTMLInputElement).checked = false;

    hideDivElementById(UI.shadowMap, "depthMapSettings");
    let htmlElement = document.getElementById('depthCascade') as HTMLInputElement;
    htmlElement.max = UI.numOfCascades.toString();
    htmlElement.value = "1";
    UI.depthMapCascade = 1;

    // change view - render depth pass or shadow maps
    document.getElementById('render')?.addEventListener('change', () => {
        const renderSelect = document.getElementById('render') as HTMLSelectElement;
        UI.renderWhat = renderSelect.value == "0" ? renderWhat.scene : renderWhat.depthMap;
        hideDivElementById(UI.renderWhat == renderWhat.scene, "depthMapSettings");
    });

    // change camera type
    document.getElementById('cameraType')?.addEventListener('change', () => {
        const cameraSelect = document.getElementById('cameraType') as HTMLSelectElement;
        UI.cameraType = cameraSelect.value == "0" ? cameraWhat.Perspective : cameraWhat.Orthographic;
        UIFlags.cameraType = true;
        console.log(`Camera changed to: ${UI.cameraType}`); 
    });

    // change shadow map on/off
    document.getElementById('shadowMapOn')?.addEventListener('change', () => {
        const shadowMapCheckbox = document.getElementById('shadowMapOn') as HTMLInputElement;
        UI.shadowMap = shadowMapCheckbox.checked;
        UIFlags.configChanged = true;
    });

    // change if cascade layers colors are showing
    document.getElementById('cascadeLayers')?.addEventListener('change', () => {
        const shadowMapCheckbox = document.getElementById('cascadeLayers') as HTMLInputElement;
        UI.cascadeLayers = shadowMapCheckbox.checked;
        UIFlags.configChanged = true;
    });

    // change if light is on
    document.getElementById('lightOn')?.addEventListener('change', () => {
        const shadowMapCheckbox = document.getElementById('lightOn') as HTMLInputElement;
        UI.lightOn = shadowMapCheckbox.checked;
        UIFlags.configChanged = true;
    });

    // get light ambient
    document.getElementById('lightAmbient')?.addEventListener('change', () => {
        const shadowMapCheckbox = document.getElementById('lightAmbient') as HTMLInputElement;
        UI.lightAmbient = shadowMapCheckbox.valueAsNumber;
        UIFlags.configChanged = true;
    });

    // change depth map cascade
    document.getElementById('depthCascade')?.addEventListener('change', () => {
        const samplesInput = document.getElementById('depthCascade') as HTMLInputElement;
        UI.depthMapCascade = samplesInput.valueAsNumber;
        UIFlags.depthMapCascade = true;
    });

    // change samples
    document.getElementById('numberOfSamples')?.addEventListener('change', () => {
        const samplesInput = document.getElementById('numberOfSamples') as HTMLInputElement;
        UI.numberOfSamples = samplesInput.valueAsNumber;
        UIFlags.configChanged = true;
    });

    // change number of cascades
    document.getElementById('numberOfCascades')?.addEventListener('change', () => {
        const samplesInput = document.getElementById('numberOfCascades') as HTMLInputElement;
        UI.numOfCascades = samplesInput.valueAsNumber;
        UIFlags.numOfCascades = true;

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
        UIFlags.depthPassSize = true;
    });

    // change direction
    document.getElementById('dirx')?.addEventListener('input', () => {
        const sizeInput = document.getElementById('dirx') as HTMLInputElement;
        UI.direction.x = sizeInput.valueAsNumber;
        UIFlags.direction = true;
    });
    document.getElementById('diry')?.addEventListener('input', () => {
        const sizeInput = document.getElementById('diry') as HTMLInputElement;
        UI.direction.y = sizeInput.valueAsNumber;
        UIFlags.direction = true;
    });
    document.getElementById('dirz')?.addEventListener('input', () => {
        const sizeInput = document.getElementById('dirz') as HTMLInputElement;
        UI.direction.z = sizeInput.valueAsNumber;
        UIFlags.direction = true;
    });

    // bias
    document.getElementById('biasValue')?.addEventListener('change', () => {
        const sizeInput = document.getElementById('biasValue') as HTMLInputElement;
        UI.biasValue = sizeInput.valueAsNumber;
        UIFlags.configChanged = true;
    });

    // lambda
    document.getElementById('lambda')?.addEventListener('change', () => {
        const sizeInput = document.getElementById('lambda') as HTMLInputElement;
        UI.lambda = sizeInput.valueAsNumber;
    });

    // lambda
    document.getElementById('AnalyticShadowsOn')?.addEventListener('change', () => {
        const shadowMapCheckbox = document.getElementById('AnalyticShadowsOn') as HTMLInputElement;
        UI.analyticShadowsOn = shadowMapCheckbox.checked;
        UIFlags.configChanged = true;
    });
    document.getElementById('coneAngle')?.addEventListener('change', () => {
        const sizeInput = document.getElementById('coneAngle') as HTMLInputElement;
        UI.coneAngle = sizeInput.valueAsNumber;
        UIFlags.configChanged = true;
    });
    document.getElementById('hemisphereRadius')?.addEventListener('change', () => {
        const sizeInput = document.getElementById('hemisphereRadius') as HTMLInputElement;
        UI.hemisphereRadius = sizeInput.valueAsNumber;
        UIFlags.configChanged = true;
    });

    document.getElementById('dirStrength')?.addEventListener('change', () => {
        const sizeInput = document.getElementById('dirStrength') as HTMLInputElement;
        UI.dirStrength = sizeInput.valueAsNumber;
        UIFlags.configChanged = true;
    });
    document.getElementById('ambStrength')?.addEventListener('change', () => {
        const sizeInput = document.getElementById('ambStrength') as HTMLInputElement;
        UI.ambStrength = sizeInput.valueAsNumber;
        UIFlags.configChanged = true;
    });
    document.getElementById('tilesX')?.addEventListener('change', () => {
        const sizeInput = document.getElementById('tilesX') as HTMLInputElement;
        UI.tilesX = sizeInput.valueAsNumber;
        UIFlags.configChanged = true;
    });
    document.getElementById('tilesY')?.addEventListener('change', () => {
        const sizeInput = document.getElementById('tilesY') as HTMLInputElement;
        UI.tilesY = sizeInput.valueAsNumber;
        UIFlags.configChanged = true;
    });

    document.getElementById('seeGrid')?.addEventListener('change', () => {
        const shadowMapCheckbox = document.getElementById('seeGrid') as HTMLInputElement;
        UI.seeGrid = shadowMapCheckbox.checked;
        UIFlags.configChanged = true;
    });
    document.getElementById('directionalOn')?.addEventListener('change', () => {
        const shadowMapCheckbox = document.getElementById('directionalOn') as HTMLInputElement;
        UI.directionalOn = shadowMapCheckbox.checked;
        UIFlags.configChanged = true;
    });
    document.getElementById('ambientOn')?.addEventListener('change', () => {
        const shadowMapCheckbox = document.getElementById('ambientOn') as HTMLInputElement;
        UI.ambientOn = shadowMapCheckbox.checked;
        UIFlags.configChanged = true;
    });

    // depthMapType
    document.getElementById('depthMapType')?.addEventListener('change', () => {
        const input = document.getElementById('depthMapType') as HTMLSelectElement;
        UI.depthMapType = Number(input.value);
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

export function changeMPF(avgMpf: number) {
    var mpfElement = document.getElementById('mpf-counter');
    if (!mpfElement) {
        console.warn('MPF counter element not found');
        return;
    }
    mpfElement.textContent = 
        "AVG MPF: " + (Math.round(avgMpf * 100) / 100).toFixed(2).toString();
}