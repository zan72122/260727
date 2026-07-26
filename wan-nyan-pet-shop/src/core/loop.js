/**
 * Fixed-timestep game loop.
 *
 * Simulation runs at a fixed rate (so behaviour is frame-rate independent and
 * reproducible); rendering happens once per animation frame. The accumulator is
 * clamped so a long tab-switch cannot produce a spiral of catch-up steps.
 */
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;
const MAX_STEPS_PER_FRAME = 5;
const MAX_FRAME_SECONDS = 0.25;

export class Loop {
  /**
   * @param {(dt:number)=>void} update fixed-step simulation callback
   * @param {(alpha:number, frameDt:number)=>void} render per-frame render callback
   * @param {object} [host] injectable rAF host (for tests)
   */
  constructor(update, render, host = globalThis) {
    this.update = update;
    this.render = render;
    this.host = host;
    this.running = false;
    this.paused = false;
    this.speed = 1;
    this.accumulator = 0;
    this.lastTime = 0;
    this.frameId = 0;
    this.frameCount = 0;
    this.lastFrameMs = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = this._now();
    this.accumulator = 0;
    this.frameId = this.host.requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this.frameId) this.host.cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  setPaused(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    // Drop accumulated time so unpausing does not fast-forward the sim.
    this.accumulator = 0;
    this.lastTime = this._now();
  }

  _now() {
    return (this.host.performance || Date).now();
  }

  _tick() {
    if (!this.running) return;
    const now = this._now();
    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;
    if (frameDt > MAX_FRAME_SECONDS) frameDt = MAX_FRAME_SECONDS;
    this.lastFrameMs = frameDt * 1000;

    if (!this.paused) {
      this.accumulator += frameDt * this.speed;
      let steps = 0;
      while (this.accumulator >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
        this.update(SIM_DT);
        this.accumulator -= SIM_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    }

    this.frameCount++;
    this.render(this.accumulator / SIM_DT, frameDt);
    this.frameId = this.host.requestAnimationFrame(this._tick);
  }
}
