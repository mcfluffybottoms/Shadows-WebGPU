export type WebGPUData = {
    canvas: HTMLCanvasElement;
    adapter: GPUAdapter;
    device: GPUDevice;
    context: GPUCanvasContext;
    defaultTexture: GPUTexture;
};

export async function getWebGPU(): Promise<WebGPUData> {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const adapter = await navigator.gpu?.requestAdapter({
        featureLevel: 'compatibility',
    });
    const device = await adapter?.requestDevice();

    const context = canvas.getContext('webgpu');
    if (!canvas || !adapter || !device || !context) {
        throw new Error('Failed to get GPU context.');
    }
    context.configure({
        device: device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
    });
    canvas.width = 1024;
    canvas.height = 1024;

    const defaultTexture = device.createTexture({
        size: [1, 1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const skyBlue = new Uint8Array([135, 206, 235, 255]);
    device.queue.writeTexture(
        { texture: defaultTexture },
        skyBlue,
        { bytesPerRow: 256 },
        [1, 1, 1]
    );

    return { canvas, adapter, device, context, defaultTexture };
}
