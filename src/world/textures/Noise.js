/**
 * Seamless procedural noise kernel for the texture library.
 *
 * Everything in here operates on flat `Float32Array` fields of size N*N and is
 * *toroidal*: the lattice period always divides the tile exactly, so every field
 * produced here tiles without a seam. No closures in the hot loops.
 *
 * Owned by the texture/material agent (src/world/*).
 */
import { makeRng, clamp, lerp } from '../../core/MathUtils.js';

// ---------------------------------------------------------------------------
// Permutation + gradient tables (512 entries -> lattice frequencies up to 512)
// ---------------------------------------------------------------------------
const TS = 512;
const TMASK = TS - 1;
const PERM = new Uint16Array(TS);
const GX = new Float32Array(TS);
const GY = new Float32Array(TS);
const HASH = new Float32Array(TS); // scalar white noise per table slot

{
  const rng = makeRng(0x5eed1);
  for (let i = 0; i < TS; i++) PERM[i] = i;
  for (let i = TS - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = PERM[i]; PERM[i] = PERM[j]; PERM[j] = t;
  }
  for (let i = 0; i < TS; i++) {
    const a = rng() * Math.PI * 2;
    GX[i] = Math.cos(a); GY[i] = Math.sin(a);
    HASH[i] = rng();
  }
}

/** Deterministic 0..1 hash of two integers (+seed). */
export function hash2i(i, j, seed) {
  const r = PERM[(j + seed * 31) & TMASK];
  return HASH[(i + r + seed * 7) & TMASK];
}

// ---------------------------------------------------------------------------
// Core periodic gradient (Perlin) layer
// ---------------------------------------------------------------------------

const _cacheIx0 = new Map(); // per (N,freq) precomputed axis tables

function axisTables(N, freq, offset) {
  const key = N * 100003 + freq * 13 + (offset * 977 | 0);
  let t = _cacheIx0.get(key);
  if (t) return t;
  const i0 = new Int32Array(N), i1 = new Int32Array(N);
  const f = new Float32Array(N), u = new Float32Array(N);
  const s = freq / N;
  for (let x = 0; x < N; x++) {
    const g = x * s + offset;
    const i = Math.floor(g);
    const fr = g - i;
    let a = i % freq; if (a < 0) a += freq;
    i0[x] = a; i1[x] = (a + 1) % freq;
    f[x] = fr;
    u[x] = fr * fr * fr * (fr * (fr * 6 - 15) + 10);
  }
  t = { i0, i1, f, u };
  if (_cacheIx0.size > 96) _cacheIx0.clear();
  _cacheIx0.set(key, t);
  return t;
}

/**
 * Add one octave of periodic gradient noise (range roughly -0.7..0.7) into `out`.
 * `freq` = number of lattice cells across the tile; must be >= 1 and <= 512.
 */
export function perlinLayer(out, N, freq, amp, seed = 0, offX = 0, offY = 0) {
  freq = Math.max(1, Math.min(TS, freq | 0));
  const ax = axisTables(N, freq, offX);
  const ay = axisTables(N, freq, offY);
  const ix0 = ax.i0, ix1 = ax.i1, fxA = ax.f, uxA = ax.u;
  const s7 = seed * 7, s31 = seed * 31;
  for (let y = 0; y < N; y++) {
    const jy0 = ay.i0[y], jy1 = ay.i1[y];
    const dy0 = ay.f[y], dy1 = dy0 - 1, v = ay.u[y];
    const r0 = PERM[(jy0 + s31) & TMASK], r1 = PERM[(jy1 + s31) & TMASK];
    const base = y * N;
    for (let x = 0; x < N; x++) {
      const a = ix0[x], b = ix1[x];
      const h00 = PERM[(a + r0 + s7) & TMASK], h10 = PERM[(b + r0 + s7) & TMASK];
      const h01 = PERM[(a + r1 + s7) & TMASK], h11 = PERM[(b + r1 + s7) & TMASK];
      const dx0 = fxA[x], dx1 = dx0 - 1;
      const n00 = GX[h00] * dx0 + GY[h00] * dy0;
      const n10 = GX[h10] * dx1 + GY[h10] * dy0;
      const n01 = GX[h01] * dx0 + GY[h01] * dy1;
      const n11 = GX[h11] * dx1 + GY[h11] * dy1;
      const u = uxA[x];
      const nx0 = n00 + (n10 - n00) * u;
      const nx1 = n01 + (n11 - n01) * u;
      out[base + x] += (nx0 + (nx1 - nx0) * v) * amp;
    }
  }
  return out;
}

/**
 * Anisotropic periodic gradient noise — independent x/y frequencies. Used for
 * brushed metal, wood grain and directional streaking.
 */
export function perlinLayerAniso(out, N, freqX, freqY, amp, seed = 0) {
  freqX = Math.max(1, Math.min(TS, freqX | 0));
  freqY = Math.max(1, Math.min(TS, freqY | 0));
  const ax = axisTables(N, freqX, 0);
  const ay = axisTables(N, freqY, 0);
  const ix0 = ax.i0, ix1 = ax.i1, fxA = ax.f, uxA = ax.u;
  const s7 = seed * 7, s31 = seed * 31;
  for (let y = 0; y < N; y++) {
    const jy0 = ay.i0[y], jy1 = ay.i1[y];
    const dy0 = ay.f[y], dy1 = dy0 - 1, v = ay.u[y];
    const r0 = PERM[(jy0 + s31) & TMASK], r1 = PERM[(jy1 + s31) & TMASK];
    const base = y * N;
    for (let x = 0; x < N; x++) {
      const a = ix0[x], b = ix1[x];
      const h00 = PERM[(a + r0 + s7) & TMASK], h10 = PERM[(b + r0 + s7) & TMASK];
      const h01 = PERM[(a + r1 + s7) & TMASK], h11 = PERM[(b + r1 + s7) & TMASK];
      const dx0 = fxA[x], dx1 = dx0 - 1;
      const n00 = GX[h00] * dx0 + GY[h00] * dy0;
      const n10 = GX[h10] * dx1 + GY[h10] * dy0;
      const n01 = GX[h01] * dx0 + GY[h01] * dy1;
      const n11 = GX[h11] * dx1 + GY[h11] * dy1;
      const u = uxA[x];
      const nx0 = n00 + (n10 - n00) * u;
      const nx1 = n01 + (n11 - n01) * u;
      out[base + x] += (nx0 + (nx1 - nx0) * v) * amp;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Periodic Worley / Voronoi
// ---------------------------------------------------------------------------
/**
 * mode 0: F1 distance (0..~1)         — pebbles / cellular pits
 * mode 1: F2 - F1 (ridges near 0)     — cracks / grout / mortar
 * mode 2: cell id hash (flat cells)   — per-cell colour variation
 * mode 3: 1 - F1 domed cells          — gravel bumps
 */
export function worley(out, N, cells, seed = 0, mode = 0, amp = 1, jitter = 1, aspect = 1) {
  cells = Math.max(1, cells | 0);
  const cellsY = Math.max(1, Math.round(cells * aspect));
  const px = new Float32Array(cells * cellsY);
  const py = new Float32Array(cells * cellsY);
  const pid = new Float32Array(cells * cellsY);
  const rng = makeRng(seed * 7919 + cells * 131 + 17);
  for (let j = 0; j < cellsY; j++) {
    for (let i = 0; i < cells; i++) {
      const k = j * cells + i;
      px[k] = i + 0.5 + (rng() - 0.5) * jitter;
      py[k] = j + 0.5 + (rng() - 0.5) * jitter;
      pid[k] = rng();
    }
  }
  const sx = cells / N, sy = cellsY / N;
  const invMax = 1 / Math.max(cells, cellsY);
  const cxT = new Int32Array(N), fxT = new Float32Array(N);
  for (let x = 0; x < N; x++) {
    const g = x * sx; const c = Math.floor(g);
    cxT[x] = c; fxT[x] = g;
  }
  for (let y = 0; y < N; y++) {
    const gy = y * sy; const cy = Math.floor(gy);
    const base = y * N;
    for (let x = 0; x < N; x++) {
      const cx = cxT[x], gx = fxT[x];
      let f1 = 1e9, f2 = 1e9, id = 0;
      for (let oy = -1; oy <= 1; oy++) {
        const jj = cy + oy;
        const row = ((jj % cellsY) + cellsY) % cellsY;
        const rowOff = row * cells;
        const oyOff = jj - row; // integer multiple of cellsY: unwraps the point
        for (let ox = -1; ox <= 1; ox++) {
          const ii = cx + ox;
          const col = ((ii % cells) + cells) % cells;
          const oxOff = ii - col;
          const k = rowOff + col;
          const dx = px[k] + oxOff - gx;
          const dy = py[k] + oyOff - gy;
          const d = dx * dx + dy * dy;
          if (d < f1) { f2 = f1; f1 = d; id = pid[k]; }
          else if (d < f2) { f2 = d; }
        }
      }
      f1 = Math.sqrt(f1); f2 = Math.sqrt(f2);
      let v;
      if (mode === 0) v = clamp(f1, 0, 1);
      else if (mode === 1) v = clamp(f2 - f1, 0, 1);
      else if (mode === 2) v = id;
      else v = clamp(1 - f1, 0, 1);
      out[base + x] += v * amp;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Field utilities
// ---------------------------------------------------------------------------

export function field(N) { return new Float32Array(N * N); }

export function fill(a, v) { a.fill(v); return a; }

export function copyField(a) { return new Float32Array(a); }

export function addScaled(dst, src, k) {
  for (let i = 0; i < dst.length; i++) dst[i] += src[i] * k;
  return dst;
}

export function mulField(dst, src) {
  for (let i = 0; i < dst.length; i++) dst[i] *= src[i];
  return dst;
}

export function scaleBias(dst, s, b) {
  for (let i = 0; i < dst.length; i++) dst[i] = dst[i] * s + b;
  return dst;
}

export function clampField(dst, lo = 0, hi = 1) {
  for (let i = 0; i < dst.length; i++) {
    const v = dst[i];
    dst[i] = v < lo ? lo : v > hi ? hi : v;
  }
  return dst;
}

export function absField(dst) {
  for (let i = 0; i < dst.length; i++) dst[i] = Math.abs(dst[i]);
  return dst;
}

export function powField(dst, p) {
  for (let i = 0; i < dst.length; i++) dst[i] = Math.pow(dst[i] < 0 ? 0 : dst[i], p);
  return dst;
}

/** Normalise to exactly [lo,hi] using the observed min/max. */
export function normalizeField(dst, lo = 0, hi = 1) {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < dst.length; i++) { const v = dst[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
  const d = mx - mn || 1;
  const s = (hi - lo) / d;
  for (let i = 0; i < dst.length; i++) dst[i] = (dst[i] - mn) * s + lo;
  return dst;
}

/** Smoothstep remap: values <= e0 -> 0, >= e1 -> 1. */
export function smoothRemap(dst, e0, e1) {
  const inv = 1 / (e1 - e0 || 1e-6);
  for (let i = 0; i < dst.length; i++) {
    let t = (dst[i] - e0) * inv;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    dst[i] = t * t * (3 - 2 * t);
  }
  return dst;
}

/** Contrast around a pivot. */
export function contrastField(dst, k, pivot = 0.5) {
  for (let i = 0; i < dst.length; i++) {
    let v = (dst[i] - pivot) * k + pivot;
    dst[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return dst;
}

export function lerpFields(dst, src, t) {
  for (let i = 0; i < dst.length; i++) dst[i] += (src[i] - dst[i]) * t;
  return dst;
}

/** dst = mix(dst, src, mask) */
export function mixMasked(dst, src, mask) {
  for (let i = 0; i < dst.length; i++) { const m = mask[i]; dst[i] = dst[i] * (1 - m) + src[i] * m; }
  return dst;
}

export function maxField(dst, src) {
  for (let i = 0; i < dst.length; i++) if (src[i] > dst[i]) dst[i] = src[i];
  return dst;
}

export function minField(dst, src) {
  for (let i = 0; i < dst.length; i++) if (src[i] < dst[i]) dst[i] = src[i];
  return dst;
}

export function invertField(dst) {
  for (let i = 0; i < dst.length; i++) dst[i] = 1 - dst[i];
  return dst;
}

// --- separable wrap-around box blur (used for cavity/AO + macro smoothing) ---
const _blurTmp = new Map();
function blurScratch(len) {
  let a = _blurTmp.get(len);
  if (!a) { a = new Float32Array(len); _blurTmp.set(len, a); }
  return a;
}

export function boxBlurWrap(src, N, r, passes = 2, out = null) {
  r = Math.max(1, r | 0);
  const dst = out || new Float32Array(src.length);
  dst.set(src);
  const tmp = blurScratch(src.length);
  const w = r * 2 + 1, inv = 1 / w;
  for (let p = 0; p < passes; p++) {
    // horizontal
    for (let y = 0; y < N; y++) {
      const base = y * N;
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += dst[base + (((k % N) + N) % N)];
      for (let x = 0; x < N; x++) {
        tmp[base + x] = sum * inv;
        const outIx = (x - r + N) % N, inIx = (x + r + 1) % N;
        sum += dst[base + inIx] - dst[base + outIx];
      }
    }
    // vertical
    for (let x = 0; x < N; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += tmp[((((k % N) + N) % N)) * N + x];
      for (let y = 0; y < N; y++) {
        dst[y * N + x] = sum * inv;
        const outIx = (y - r + N) % N, inIx = (y + r + 1) % N;
        sum += tmp[inIx * N + x] - tmp[outIx * N + x];
      }
    }
  }
  return dst;
}

/** Bilinear wrap sample of a field at pixel coords. */
export function sampleWrap(src, N, x, y) {
  let x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  x0 = ((x0 % N) + N) % N; y0 = ((y0 % N) + N) % N;
  const x1 = x0 + 1 === N ? 0 : x0 + 1;
  const y1 = y0 + 1 === N ? 0 : y0 + 1;
  const r0 = y0 * N, r1 = y1 * N;
  const a = src[r0 + x0], b = src[r0 + x1], c = src[r1 + x0], d = src[r1 + x1];
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

/**
 * Domain warp: dst[i] = src sampled at (x + wx*ax, y + wy*ay). Toroidal, so the
 * result stays seamless. Warp fields should be roughly -1..1.
 */
export function warpField(dst, src, N, wx, wy, ax, ay = ax) {
  for (let y = 0; y < N; y++) {
    const base = y * N;
    for (let x = 0; x < N; x++) {
      const i = base + x;
      dst[i] = sampleWrap(src, N, x + wx[i] * ax, y + wy[i] * ay);
    }
  }
  return dst;
}

// ---------------------------------------------------------------------------
// Noise bank — caches raw octaves so 20 materials don't each pay for them
// ---------------------------------------------------------------------------
export class NoiseBank {
  constructor(N, maxLayers = 22) {
    this.N = N;
    this.max = maxLayers;
    this.map = new Map();
  }
  /** Raw signed periodic perlin at `freq` for `seed`, cached. */
  layer(freq, seed) {
    const key = (freq | 0) * 1000 + (seed | 0);
    let l = this.map.get(key);
    if (l) { this.map.delete(key); this.map.set(key, l); return l; }
    l = new Float32Array(this.N * this.N);
    perlinLayer(l, this.N, freq, 1, seed);
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
    this.map.set(key, l);
    return l;
  }
  clear() { this.map.clear(); }
}

/**
 * fBm accumulated from bank layers.
 * mode: 'fbm' | 'ridged' | 'billow' | 'turbulence'
 */
export function bankFbm(out, bank, opts) {
  const {
    base = 4, octaves = 6, gain = 0.5, lacunarity = 2,
    seed = 1, amp = 1, mode = 'fbm',
  } = opts;
  let f = base, a = 1, norm = 0;
  const layers = [];
  for (let o = 0; o < octaves; o++) {
    if (f > 512) break;
    layers.push([bank.layer(Math.round(f), seed + o * 3), a]);
    norm += a;
    f *= lacunarity; a *= gain;
  }
  const k = amp / (norm || 1);
  const n = out.length;
  if (mode === 'fbm') {
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li][0], w = layers[li][1] * k;
      for (let i = 0; i < n; i++) out[i] += L[i] * w;
    }
  } else if (mode === 'billow' || mode === 'turbulence') {
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li][0], w = layers[li][1] * k;
      for (let i = 0; i < n; i++) out[i] += Math.abs(L[i]) * w;
    }
  } else { // ridged
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li][0], w = layers[li][1] * k;
      for (let i = 0; i < n; i++) { const v = 1 - Math.abs(L[i]) * 1.6; out[i] += (v > 0 ? v * v : 0) * w; }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Derived maps
// ---------------------------------------------------------------------------

/**
 * Sobel normal map from a height field. Writes tangent-space RGB into an
 * RGBA Uint8 buffer (linear colour space, +Y up = OpenGL convention, which is
 * what three.js expects).
 */
export function normalFromHeight(height, N, strength, out) {
  const dst = out || new Uint8Array(N * N * 4);
  // Sobel over a 3x3 wrap-around neighbourhood.
  for (let y = 0; y < N; y++) {
    const ym = ((y - 1 + N) % N) * N, y0 = y * N, yp = ((y + 1) % N) * N;
    for (let x = 0; x < N; x++) {
      const xm = (x - 1 + N) % N, xp = (x + 1) % N;
      const h00 = height[ym + xm], h10 = height[ym + x], h20 = height[ym + xp];
      const h01 = height[y0 + xm], h21 = height[y0 + xp];
      const h02 = height[yp + xm], h12 = height[yp + x], h22 = height[yp + xp];
      const gx = (h00 + 2 * h01 + h02) - (h20 + 2 * h21 + h22);
      const gy = (h00 + 2 * h10 + h20) - (h02 + 2 * h12 + h22);
      let nx = gx * strength, ny = gy * strength, nz = 1;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      nx *= inv; ny *= inv; nz *= inv;
      const i = (y0 + x) * 4;
      dst[i] = (nx * 0.5 + 0.5) * 255 + 0.5;
      dst[i + 1] = (ny * 0.5 + 0.5) * 255 + 0.5;
      dst[i + 2] = (nz * 0.5 + 0.5) * 255 + 0.5;
      dst[i + 3] = 255;
    }
  }
  return dst;
}

/**
 * Multi-radius cavity AO. Compares the height field against progressively
 * blurred versions of itself: pixels sitting well below their neighbourhood
 * average are occluded. Returns 0..1.
 */
export function aoFromHeight(height, N, opts = {}) {
  const radii = opts.radii || [2, 5, 12, 28];
  const weights = opts.weights || [0.22, 0.28, 0.28, 0.22];
  const strength = opts.strength ?? 1;
  const n = N * N;
  const ao = new Float32Array(n);
  ao.fill(1);
  const scratch = new Float32Array(n);
  for (let r = 0; r < radii.length; r++) {
    const rad = Math.max(1, Math.round(radii[r] * N / 1024));
    boxBlurWrap(height, N, rad, 2, scratch);
    const w = weights[r] * strength;
    // occlusion grows with how far below the local average we sit
    const gain = 3.2 * w;
    for (let i = 0; i < n; i++) {
      const d = scratch[i] - height[i];
      if (d > 0) ao[i] -= d * gain;
    }
  }
  for (let i = 0; i < n; i++) {
    let v = ao[i];
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    // gentle gamma so AO doesn't crush
    ao[i] = 0.12 + 0.88 * (v * v * (3 - 2 * v));
  }
  return ao;
}

/**
 * Curvature / cavity signal: positive on convex peaks (edge wear), negative in
 * crevices (grime). Range roughly -1..1.
 */
export function curvature(height, N, radius = 5) {
  const n = N * N;
  const b = boxBlurWrap(height, N, Math.max(1, Math.round(radius * N / 1024)), 2);
  const c = new Float32Array(n);
  let mx = 1e-6;
  for (let i = 0; i < n; i++) { const d = height[i] - b[i]; c[i] = d; const a = Math.abs(d); if (a > mx) mx = a; }
  const inv = 1 / mx;
  for (let i = 0; i < n; i++) c[i] *= inv;
  return c;
}

// ---------------------------------------------------------------------------
// Colour helpers (author in sRGB hex, work in linear, encode on pack)
// ---------------------------------------------------------------------------
const SRGB_LUT = new Uint8Array(4096);
for (let i = 0; i < 4096; i++) {
  const l = i / 4095;
  const s = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  SRGB_LUT[i] = Math.round(clamp(s, 0, 1) * 255);
}
export function linearToSrgbByte(l) {
  const i = l <= 0 ? 0 : l >= 1 ? 4095 : (l * 4095) | 0;
  return SRGB_LUT[i];
}

export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** '#rrggbb' -> [r,g,b] linear floats. */
export function hexLin(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
}

export { clamp, lerp, makeRng };
