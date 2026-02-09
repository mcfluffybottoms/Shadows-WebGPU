export type webGPUData = {
  canvas: HTMLCanvasElement;
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
};

export async function getWebGPU(): Promise<webGPUData> {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  const adapter = await navigator.gpu?.requestAdapter({
    featureLevel: 'compatibility',
  });
  const device = await adapter?.requestDevice();
  const context = canvas.getContext('webgpu');
  if(!canvas || !adapter || !device || !context) {
    throw new Error("Failed to get GPU context.");
  }
  context.configure({
    device: device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: 'premultiplied'
  });
  canvas.width = 1024;
  canvas.height = 1024;
  return { canvas, adapter, device, context };
}