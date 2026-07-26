import { Settings } from './Settings.js';

/**
 * Pointer-lock FPS input. Accumulates raw mouse deltas per frame (consumed by the
 * camera controller) and exposes edge-triggered action queries.
 */
export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.pressedThisFrame = new Set();
    this.releasedThisFrame = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0 };
    this.buttons = new Set();
    this.buttonsPressed = new Set();
    this.buttonsReleased = new Set();
    this.locked = false;
    this.enabled = true;
    this._onLockChange = null;

    this._bind();
  }

  _bind() {
    const kd = (e) => {
      if (e.repeat) return;
      const c = e.code;
      if (!this.keys.has(c)) this.pressedThisFrame.add(c);
      this.keys.add(c);
      if (this.locked && ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash'].includes(c)) e.preventDefault();
    };
    const ku = (e) => { this.keys.delete(e.code); this.releasedThisFrame.add(e.code); };
    const md = (e) => { if (!this.locked) return; this.buttons.add(e.button); this.buttonsPressed.add(e.button); };
    const mu = (e) => { this.buttons.delete(e.button); this.buttonsReleased.add(e.button); };
    const mm = (e) => {
      if (!this.locked || !this.enabled) return;
      // Chrome can deliver absurd spikes on lock acquisition; clamp them out.
      const dx = Math.abs(e.movementX) > 200 ? 0 : e.movementX;
      const dy = Math.abs(e.movementY) > 200 ? 0 : e.movementY;
      this.mouse.dx += dx;
      this.mouse.dy += dy;
    };
    const wh = (e) => { if (this.locked) { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); } };
    const blur = () => { this.keys.clear(); this.buttons.clear(); };

    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('mousedown', md);
    window.addEventListener('mouseup', mu);
    window.addEventListener('mousemove', mm);
    window.addEventListener('wheel', wh, { passive: false });
    window.addEventListener('blur', blur);
    window.addEventListener('contextmenu', (e) => { if (this.locked) e.preventDefault(); });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      this.mouse.dx = this.mouse.dy = 0;
      this._onLockChange?.(this.locked);
    });
  }

  requestLock() {
    if (!this.locked) this.dom.requestPointerLock?.({ unadjustedMovement: true })?.catch?.(() => this.dom.requestPointerLock());
  }
  exitLock() { document.exitPointerLock?.(); }
  onLockChange(fn) { this._onLockChange = fn; }

  down(code)     { return this.enabled && this.keys.has(code); }
  pressed(code)  { return this.enabled && this.pressedThisFrame.has(code); }
  released(code) { return this.enabled && this.releasedThisFrame.has(code); }
  mouseDown(b)   { return this.enabled && this.buttons.has(b); }
  mousePressed(b){ return this.enabled && this.buttonsPressed.has(b); }
  mouseReleased(b){ return this.enabled && this.buttonsReleased.has(b); }

  /** Movement intent in local space: x = strafe, z = forward. */
  moveVector(out) {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    const l = Math.hypot(x, z);
    if (l > 1e-5) { x /= l; z /= l; }
    out.set(x, 0, z);
    return out;
  }

  /** Consume accumulated look delta (radians), applying sensitivity + inversion. */
  consumeLook(sensScale = 1) {
    const s = Settings.sensitivity * sensScale;
    const yaw = -this.mouse.dx * s;
    const pitch = (Settings.invertY ? 1 : -1) * this.mouse.dy * s;
    this.mouse.dx = 0; this.mouse.dy = 0;
    return { yaw, pitch };
  }

  endFrame() {
    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    this.buttonsPressed.clear();
    this.buttonsReleased.clear();
    this.mouse.wheel = 0;
  }
}
