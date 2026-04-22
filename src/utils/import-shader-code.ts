import commonsCode from '../shader/shadow-map/commons.wgsl?raw';

export function importShaderCode(shaderCode: string) {
    return commonsCode + "\n" + shaderCode;
}