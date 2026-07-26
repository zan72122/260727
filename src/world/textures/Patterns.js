/**
 * Structural (non-noise) pattern generators: brick bonds, tile grids, plank
 * rows, panel seams, rivets, chainlink diamonds, grating bars.
 *
 * All of these are exactly periodic over the tile so the results stay seamless.
 */
import { hash2i, sampleWrap } from './Noise.js';

const sstep = (e0, e1, x) => {
  let t = (x - e0) / (e1 - e0 || 1e-6);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
};

/**
 * Running-bond rectangle grid (bricks / tiles / metal panels).
 *
 * Returns:
 *   face   0..1 — 1 on the raised face, 0 in the joint (bevelled edge)
 *   id     0..1 — per-cell random id (colour / height jitter)
 *   idB    0..1 — second decorrelated per-cell id
 *   uEdge  0..1 — distance to nearest joint, normalised (for edge wear)
 */
export function rectGrid(N, opts = {}) {
  const {
    cols = 8, rows = 16, offset = 0.5, jointPx = 7, bevelPx = 5,
    seed = 1, warpX = null, warpY = null, warpAmt = 0,
  } = opts;
  const face = new Float32Array(N * N);
  const id = new Float32Array(N * N);
  const idB = new Float32Array(N * N);
  const uEdge = new Float32Array(N * N);
  const cw = N / cols, ch = N / rows;      // cell size in pixels
  const jU = jointPx / cw * 0.5, jV = jointPx / ch * 0.5;
  const bU = bevelPx / cw, bV = bevelPx / ch;
  for (let y = 0; y < N; y++) {
    const base = y * N;
    for (let x = 0; x < N; x++) {
      const i = base + x;
      let px = x, py = y;
      if (warpAmt) { px += warpX[i] * warpAmt; py += warpY[i] * warpAmt; }
      const v = py / ch;
      let row = Math.floor(v);
      const fv = v - row;
      row = ((row % rows) + rows) % rows;
      const u = px / cw + row * offset;
      let col = Math.floor(u);
      const fu = u - col;
      col = ((col % cols) + cols) % cols;
      const du = Math.min(fu, 1 - fu);
      const dv = Math.min(fv, 1 - fv);
      const fU = sstep(jU, jU + bU, du);
      const fV = sstep(jV, jV + bV, dv);
      face[i] = fU * fV;
      id[i] = hash2i(col, row, seed);
      idB[i] = hash2i(col + 41, row + 97, seed + 5);
      uEdge[i] = Math.min(du / (jU + bU + 1e-6), dv / (jV + bV + 1e-6));
    }
  }
  return { face, id, idB, uEdge };
}

/**
 * Horizontal plank rows, each split into a whole number of boards with a
 * random phase — seamless in both axes.
 */
export function plankRows(N, opts = {}) {
  const { rows = 7, segsMin = 2, segsMax = 3, gapPx = 5, bevelPx = 6, seed = 3, vertical = false } = opts;
  const face = new Float32Array(N * N);
  const id = new Float32Array(N * N);
  const idB = new Float32Array(N * N);
  const along = new Float32Array(N * N);   // 0..1 position along the board
  const across = new Float32Array(N * N);  // -1..1 across the board
  const ch = N / rows;
  const jV = gapPx / ch * 0.5, bV = bevelPx / ch;
  const segsOf = new Int32Array(rows), phaseOf = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    segsOf[r] = segsMin + Math.floor(hash2i(r, 7, seed) * (segsMax - segsMin + 1));
    phaseOf[r] = hash2i(r, 19, seed + 2);
  }
  for (let y = 0; y < N; y++) {
    const base = y * N;
    for (let x = 0; x < N; x++) {
      const i = base + x;
      const a = vertical ? x : y;      // across-board axis
      const b = vertical ? y : x;      // along-board axis
      const v = a / ch;
      let row = Math.floor(v);
      const fv = v - row;
      row = ((row % rows) + rows) % rows;
      const segs = segsOf[row];
      const cw = N / segs;
      const jU = gapPx / cw * 0.5, bU = bevelPx / cw;
      const u = b / cw + phaseOf[row];
      let col = Math.floor(u);
      const fu = u - col;
      col = ((col % segs) + segs) % segs;
      const du = Math.min(fu, 1 - fu), dv = Math.min(fv, 1 - fv);
      face[i] = sstep(jU, jU + bU, du) * sstep(jV, jV + bV, dv);
      id[i] = hash2i(col, row * 7 + segs, seed);
      idB[i] = hash2i(col + 53, row + 11, seed + 9);
      along[i] = fu;
      across[i] = fv * 2 - 1;
    }
  }
  return { face, id, idB, along, across };
}

/** Diamond chainlink mesh: returns { wire (0..1 coverage), height, depth } */
export function diamondMesh(N, opts = {}) {
  const { cells = 6, wirePx = 9 } = opts;
  const wire = new Float32Array(N * N);
  const height = new Float32Array(N * N);
  const p = N / cells;
  const inv = 1 / p;
  const half = wirePx * 0.5;
  const soft = 1.6;
  for (let y = 0; y < N; y++) {
    const base = y * N;
    for (let x = 0; x < N; x++) {
      // two diagonal wire families
      const a = (x + y) * inv, b = (x - y) * inv;
      let fa = a - Math.floor(a); fa = Math.min(fa, 1 - fa);
      let fb = b - Math.floor(b); fb = Math.min(fb, 1 - fb);
      // distance in pixels perpendicular to the diagonal (÷sqrt2)
      const da = fa * p * 0.7071, db = fb * p * 0.7071;
      const wa = sstep(half + soft, half - soft, da);
      const wb = sstep(half + soft, half - soft, db);
      const w = Math.max(wa, wb);
      const i = base + x;
      wire[i] = w;
      // rounded wire cross-section
      const d = Math.min(da, db);
      const t = Math.max(0, 1 - d / (half + 0.5));
      height[i] = Math.sqrt(t) * w;
    }
  }
  return { wire, height };
}

/** Parallel bar grating: thick bars one way, thin cross-ties the other. */
export function barGrating(N, opts = {}) {
  const { bars = 8, crossTies = 3, barPx = 26, tiePx = 12 } = opts;
  const mask = new Float32Array(N * N);
  const height = new Float32Array(N * N);
  const pb = N / bars, pt = N / crossTies;
  for (let y = 0; y < N; y++) {
    const base = y * N;
    const fy0 = y / pb; const fy = Math.abs((fy0 - Math.floor(fy0)) - 0.5) * 2; // 0 centre .. 1 edge
    const dBar = (1 - fy) * pb * 0.5;
    const bar = sstep(barPx * 0.5 + 1.5, barPx * 0.5 - 1.5, dBar);
    for (let x = 0; x < N; x++) {
      const fx0 = x / pt; const fx = Math.abs((fx0 - Math.floor(fx0)) - 0.5) * 2;
      const dTie = (1 - fx) * pt * 0.5;
      const tie = sstep(tiePx * 0.5 + 1.5, tiePx * 0.5 - 1.5, dTie);
      const i = base + x;
      const m = Math.max(bar, tie);
      mask[i] = m;
      height[i] = bar * (0.55 + 0.45 * sstep(0, barPx * 0.4, dBar)) + tie * 0.42 * (1 - bar);
    }
  }
  return { mask, height };
}

/** Round-headed rivets/bolts laid out on a grid; adds domes into `height`. */
export function addRivets(height, N, opts = {}) {
  const { cols = 4, rows = 8, radiusPx = 7, amp = 0.35, seed = 5, inset = 0.5, jitter = 0 } = opts;
  const cw = N / cols, ch = N / rows;
  const r2 = radiusPx * radiusPx;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (hash2i(i, j, seed) < 0.06) continue; // a few missing
      const cx = (i + inset) * cw + (hash2i(i, j, seed + 3) - 0.5) * jitter;
      const cy = (j + inset) * ch + (hash2i(i, j, seed + 8) - 0.5) * jitter;
      const rr = Math.ceil(radiusPx) + 1;
      for (let dy = -rr; dy <= rr; dy++) {
        const py = ((Math.round(cy) + dy) % N + N) % N;
        const base = py * N;
        for (let dx = -rr; dx <= rr; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const px = ((Math.round(cx) + dx) % N + N) % N;
          const t = 1 - d2 / r2;
          height[base + px] += Math.sqrt(t) * amp;
        }
      }
    }
  }
  return height;
}

/**
 * Wood grain: concentric rings warped by noise, plus radial knots.
 * `along`/`across` come from plankRows so grain follows each board.
 */
export function woodGrain(N, opts = {}) {
  const { rings = 34, warpX, warpY, warpAmt = 26, knots = 5, seed = 4, vertical = false } = opts;
  const grain = new Float32Array(N * N);
  const knot = new Float32Array(N * N);
  const kx = new Float32Array(knots), ky = new Float32Array(knots), kr = new Float32Array(knots);
  for (let k = 0; k < knots; k++) {
    kx[k] = hash2i(k, 1, seed) * N;
    ky[k] = hash2i(k, 2, seed + 1) * N;
    kr[k] = (0.02 + hash2i(k, 3, seed + 2) * 0.035) * N;
  }
  const TAU = Math.PI * 2;
  for (let y = 0; y < N; y++) {
    const base = y * N;
    for (let x = 0; x < N; x++) {
      const i = base + x;
      const a = (vertical ? x : y) + (warpX ? warpX[i] * warpAmt : 0);
      // rings run across the board; use a triangle wave for a hard latewood band
      const t = a / N * rings + (warpY ? warpY[i] * 0.9 : 0);
      const f = t - Math.floor(t);
      const tri = Math.abs(f * 2 - 1);
      grain[i] = Math.pow(tri, 0.65);
      let kAcc = 0;
      for (let k = 0; k < knots; k++) {
        let dx = x - kx[k], dy = y - ky[k];
        if (dx > N * 0.5) dx -= N; if (dx < -N * 0.5) dx += N;
        if (dy > N * 0.5) dy -= N; if (dy < -N * 0.5) dy += N;
        const d = Math.sqrt(dx * dx + dy * dy * 3.2) / kr[k];
        if (d < 3.2) {
          const ring = 0.5 + 0.5 * Math.cos(d * 7.5);
          kAcc = Math.max(kAcc, Math.max(0, 1 - d / 3.2) * (0.35 + 0.65 * ring));
        }
      }
      knot[i] = kAcc;
    }
  }
  return { grain, knot };
}

export { sampleWrap };
