export interface ModelBuffers {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer | null;
  texture?: GPUTexture;

  vertexCount: number;
  indexCount: number;
};