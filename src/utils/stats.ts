export class Stats {
  public avgMpf: number;
  public fps: number;
  private frameCount: number;
  private frameEnd: number
  private frameStart: number;
  private lastTime: number;
  private mpf: number;
  private mpfHistory: number[];

  constructor() {
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.fps = 0;
    this.mpf = 0;
    this.avgMpf = 0;
    this.mpfHistory = [];
    this.frameStart = 0;
    this.frameEnd = 0;
  }

  public end() {
    this.frameEnd = performance.now();
    
    // ------ PROFILING ------ //
    this.mpf = this.frameEnd - this.frameStart;
    this.mpfHistory.push(this.mpf);
    if (this.mpfHistory.length > 60) this.mpfHistory.shift();

    this.frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - this.lastTime;
    if (elapsed >= 1000) {
        // FPS
        this.fps = Math.round((this.frameCount * 1000) / elapsed);
        this.frameCount = 0;
        this.lastTime = currentTime;
        // MPF
        this.avgMpf = this.mpfHistory.reduce((sum, val) => sum + val, 0) / this.mpfHistory.length;
        this.mpfHistory = [];
    }

    return elapsed >= 1000;
  }

  public start() {
    this.frameStart = performance.now();
  }
}