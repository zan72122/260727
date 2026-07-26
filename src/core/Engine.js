import * as THREE from 'three';
import { bus, EV } from './EventBus.js';
import { Input } from './Input.js';
import { Settings } from './Settings.js';
import { clamp } from './MathUtils.js';

/**
 * Fixed-timestep simulation + variable-timestep render loop.
 *
 * A "system" is any object with a subset of:
 *   name           string  (required, unique)
 *   priority       number  (lower runs first; default 100)
 *   init(ctx)      async   one-time setup, awaited during boot
 *   fixedUpdate(h, ctx)    deterministic sim step (physics, AI, ballistics)
 *   update(dt, ctx)        per-frame logic (input, animation, FX)
 *   lateUpdate(dt, ctx)    after all updates (camera, viewmodel, HUD)
 *   resize(w, h, ctx)
 *   dispose()
 *
 * Systems never reach into each other directly; they read `ctx` and talk over `bus`.
 */
export const FIXED_STEP = 1 / 120;
const MAX_FRAME_DT = 0.25;
const MAX_SUBSTEPS = 8;

export class Engine {
  constructor(container) {
    this.container = container;
    this.systems = [];
    this.byName = new Map();
    this.running = false;
    this.paused = false;
    this.accumulator = 0;
    this.elapsed = 0;
    this.frame = 0;
    this._raf = 0;
    this._last = 0;

    this.clock = { dt: 0, fixed: FIXED_STEP, elapsed: 0, alpha: 0, frame: 0, fps: 60, smoothDt: 1 / 60 };

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(Settings.fov, 1, 0.06, 900);
    this.camera.rotation.order = 'YXZ';

    this.input = new Input(container);
    this.bus = bus;

    /** Shared mutable context handed to every system. Systems attach their own
     *  public surface here during init (e.g. ctx.physics, ctx.player). */
    this.ctx = {
      engine: this,
      scene: this.scene,
      camera: this.camera,
      renderer: null,
      clock: this.clock,
      input: this.input,
      bus,
      EV,
      settings: Settings,
      container,
      /** Frame-scoped scratch objects to avoid per-frame allocation. */
      tmp: {
        v1: new THREE.Vector3(), v2: new THREE.Vector3(), v3: new THREE.Vector3(),
        q1: new THREE.Quaternion(), q2: new THREE.Quaternion(),
        m1: new THREE.Matrix4(), e1: new THREE.Euler(),
        ray: new THREE.Ray(), box: new THREE.Box3(),
      },
    };

    this._onResize = this._onResize.bind(this);
    this._tick = this._tick.bind(this);
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._last = 0;
    });
  }

  add(system) {
    if (!system?.name) throw new Error('System requires a unique `name`');
    if (this.byName.has(system.name)) throw new Error(`Duplicate system: ${system.name}`);
    system.priority = system.priority ?? 100;
    this.systems.push(system);
    this.byName.set(system.name, system);
    this.systems.sort((a, b) => a.priority - b.priority);
    return system;
  }

  get(name) { return this.byName.get(name); }

  async init() {
    for (const s of this.systems) {
      if (s.init) {
        const t0 = performance.now();
        await s.init(this.ctx);
        const ms = performance.now() - t0;
        if (ms > 40) console.info(`[boot] ${s.name}: ${ms.toFixed(0)}ms`);
      }
    }
    this._onResize();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  setPaused(p) {
    if (this.paused === p) return;
    this.paused = p;
    this.accumulator = 0;
    this._last = performance.now();
    bus.emit(EV.STATE_CHANGE, { paused: p });
  }

  _tick(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);

    if (!this._last) this._last = now;
    let dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;      // tab-switch / hitch guard
    if (!Number.isFinite(dt) || dt < 0) dt = 1 / 60;

    const c = this.clock;
    c.smoothDt += (dt - c.smoothDt) * 0.08;
    c.fps = 1 / Math.max(1e-4, c.smoothDt);

    const simDt = this.paused ? 0 : dt;
    c.dt = simDt;
    this.elapsed += simDt;
    c.elapsed = this.elapsed;
    c.frame = ++this.frame;

    // ---- fixed-step simulation -------------------------------------------
    this.accumulator += simDt;
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < MAX_SUBSTEPS) {
      for (const s of this.systems) s.fixedUpdate?.(FIXED_STEP, this.ctx);
      this.accumulator -= FIXED_STEP;
      steps++;
    }
    if (steps >= MAX_SUBSTEPS) this.accumulator = 0;   // give up rather than spiral
    c.alpha = clamp(this.accumulator / FIXED_STEP, 0, 1);

    // ---- variable-step update --------------------------------------------
    for (const s of this.systems) s.update?.(simDt, this.ctx);
    for (const s of this.systems) s.lateUpdate?.(simDt, this.ctx);

    this.input.endFrame();
  }

  _onResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const s of this.systems) s.resize?.(w, h, this.ctx);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    for (const s of this.systems) s.dispose?.();
    this.systems.length = 0;
    this.byName.clear();
  }
}
