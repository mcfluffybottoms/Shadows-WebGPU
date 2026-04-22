export interface ModelBuffers {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer | null;
  color?: GPUBuffer;

  vertexCount: number;
  indexCount: number;
};