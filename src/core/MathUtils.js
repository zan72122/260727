export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a || 1);
export const smoothstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const smootherstep = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

/** Framerate-independent exponential smoothing. `rate` ~ how much remains after 1s. */
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.pow(rate, dt));
export const expDecay = (a, b, lambda, dt) => b + (a - b) * Math.exp(-lambda * dt);

export const randRange = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(randRange(a, b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const gaussian = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/** Deterministic PRNG (mulberry32) — used for anything that must be reproducible. */
export function makeRng(seed = 1337) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shortest signed angular difference, radians. */
export const angleDelta = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** Critically-damped spring — the workhorse for weapon sway / camera smoothing. */
export class Spring {
  constructor(value = 0, stiffness = 120, damping = 18) {
    this.value = value; this.target = value; this.velocity = 0;
    this.stiffness = stiffness; this.damping = damping;
  }
  update(dt) {
    // Semi-implicit Euler, substepped for stability at low framerates.
    const steps = dt > 1 / 45 ? 2 : 1;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const f = (this.target - this.value) * this.stiffness - this.velocity * this.damping;
      this.velocity += f * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
  impulse(v) { this.velocity += v; }
  set(v) { this.value = this.target = v; this.velocity = 0; }
}

/** 3-axis spring for positional offsets (recoil kick, landing dip, sway). */
export class Spring3 {
  constructor(stiffness = 120, damping = 18) {
    this.x = new Spring(0, stiffness, damping);
    this.y = new Spring(0, stiffness, damping);
    this.z = new Spring(0, stiffness, damping);
  }
  set stiffness(v) { this.x.stiffness = this.y.stiffness = this.z.stiffness = v; }
  set damping(v) { this.x.damping = this.y.damping = this.z.damping = v; }
  target(x, y, z) { this.x.target = x; this.y.target = y; this.z.target = z; }
  impulse(x, y, z) { this.x.impulse(x); this.y.impulse(y); this.z.impulse(z); }
  update(dt) { this.x.update(dt); this.y.update(dt); this.z.update(dt); return this; }
  applyTo(v3) { v3.set(this.x.value, this.y.value, this.z.value); return v3; }
  addTo(v3) { v3.x += this.x.value; v3.y += this.y.value; v3.z += this.z.value; return v3; }
}

/** Simple 2D value noise with fBm — used by procedural textures and camera sway. */
export function makeNoise2D(seed = 1) {
  const rng = makeRng(seed);
  const P = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => {
    switch (h & 3) {
      case 0: return  x + y;
      case 1: return -x + y;
      case 2: return  x - y;
      default: return -x - y;
    }
  };
  const noise = (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const A = P[X] + Y, B = P[X + 1] + Y;
    return lerp(
      lerp(grad(P[A], x, y),     grad(P[B], x - 1, y), u),
      lerp(grad(P[A + 1], x, y - 1), grad(P[B + 1], x - 1, y - 1), u), v);
  };
  noise.fbm = (x, y, octaves = 5, lacunarity = 2, gain = 0.5) => {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * freq, y * freq) * amp;
      norm += amp; amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  };
  noise.ridged = (x, y, octaves = 5) => {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(noise(x * freq, y * freq));
      sum += n * n * amp; norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  };
  return noise;
}
