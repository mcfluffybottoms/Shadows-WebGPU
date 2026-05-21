import commonsCode from '../shader/commons.wgsl?raw';

export function importShaderCode(shaderCode: string) {
    return commonsCode + "\n" + shaderCode;
}