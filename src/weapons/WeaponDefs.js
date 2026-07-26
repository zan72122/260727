/**
 * OVERSTRIKE — weapon data.
 *
 * Everything that makes a gun *feel* like itself lives here as data: fire rate,
 * the authored recoil pattern, spread envelopes, timings. `WeaponModels` reads
 * `model` to pick a procedural build recipe; `Viewmodel` reads `pose` for the
 * hip/ADS/sprint transforms; `Ballistics` reads the rest.
 *
 * Angles are degrees in the data (readable), converted to radians on load.
 * Distances are metres, times are seconds.
 *
 * ── recoil pattern ─────────────────────────────────────────────────────────
 * `recoil.pattern` is an authored per-shot [pitchUp, yaw] sequence in degrees.
 * Real guns climb on a *learnable* curve: hard vertical for the first burst,
 * then a horizontal drift that reverses. Randomness is added on top at
 * `recoil.randomness` strength so the pattern is learnable but not robotic.
 * The last entry repeats once the magazine runs past the pattern length.
 */

const D = Math.PI / 180;

/** Piecewise-linear damage over distance: [[metres, damage], ...] */
function curve(points) {
  return {
    points,
    at(d) {
      const p = points;
      if (d <= p[0][0]) return p[0][1];
      for (let i = 1; i < p.length; i++) {
        if (d <= p[i][0]) {
          const t = (d - p[i - 1][0]) / (p[i][0] - p[i - 1][0] || 1);
          return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
        }
      }
      return p[p.length - 1][1];
    },
  };
}

/** @type {Record<string, any>} */
const RAW = {
  // ───────────────────────────────────────────────────── assault rifle ─────
  ar: {
    id: 'ar',
    name: 'KV-7 CARBINE',
    kind: 'rifle',
    slot: 0,
    model: 'ar',
    fireMode: 'auto',
    rpm: 700,
    /** First N shots of a trigger pull get a rate + recoil emphasis — reads as
     *  a controlled burst even in full-auto. */
    burstEmphasis: { shots: 3, recoilScale: 1.34, rpmScale: 1.06 },
    pellets: 1,
    damage: curve([[0, 27], [22, 27], [46, 19], [80, 14]]),
    headshotMul: 2.0,
    armorPen: 0.35,
    penetration: { maxThickness: 0.14, damageScale: 0.55, maxSurfaces: 2 },
    muzzleVelocity: 780,
    projectile: false,
    magazine: 30,
    reserve: 210,
    spread: { hip: 2.15, ads: 0.16, moveAdd: 1.5, crouchMul: 0.68, airAdd: 3.6, sprintAdd: 3.0 },
    bloom: { perShot: 0.32, max: 3.1, decay: 5.2, adsMul: 0.34 },
    recoil: {
      pattern: [
        [1.00, 0.00], [1.15, -0.14], [1.22, 0.20], [1.05, 0.34], [0.92, 0.46],
        [0.86, 0.52], [0.80, 0.44], [0.74, 0.22], [0.70, -0.10], [0.66, -0.38],
        [0.62, -0.55], [0.60, -0.62], [0.58, -0.52], [0.56, -0.30], [0.54, 0.02],
        [0.52, 0.34], [0.50, 0.56], [0.49, 0.64], [0.48, 0.55], [0.47, 0.30],
        [0.46, -0.05], [0.45, -0.36], [0.44, -0.58], [0.44, -0.62], [0.43, -0.46],
        [0.43, -0.18], [0.42, 0.16], [0.42, 0.44], [0.41, 0.58], [0.41, 0.50],
      ],
      randomness: 0.22,
      adsMul: 0.72,
      recovery: 0.86,          // fraction of camera kick pulled back
      recoverySpeed: 7.5,
      // viewmodel kick
      vmKick: { back: 0.030, up: 0.011, pitch: 5.4, yaw: 1.5, roll: 2.4 },
      shake: { amp: 0.30, freq: 26, dur: 0.10 },
    },
    ads: { time: 0.235, fovScale: 0.80, vmFovScale: 0.92, sensScale: 0.78 },
    reload: { tactical: 1.9, empty: 2.6, magOut: 0.42, magIn: 0.98, chargeAt: 2.02 },
    swap: { out: 0.30, in: 0.42 },
    shell: { type: 'rifle', velocity: [2.7, 1.5, 0.4], spinScale: 1.0 },
    crosshair: { base: 9, thickness: 2 },
    tracerEvery: 3,
    optic: 'reddot',
    ammoType: '5.56×45',
  },

  // ────────────────────────────────────────────────────── pump shotgun ─────
  shotgun: {
    id: 'shotgun',
    name: 'BRK-12 BREACHER',
    kind: 'shotgun',
    slot: 1,
    model: 'shotgun',
    fireMode: 'pump',
    rpm: 78,                      // gated by the pump cycle anyway
    pumpTime: 0.62,
    pellets: 8,
    damage: curve([[0, 15.5], [7, 15.5], [16, 7.5], [26, 3.4]]),
    headshotMul: 1.5,
    armorPen: 0.1,
    penetration: { maxThickness: 0.05, damageScale: 0.3, maxSurfaces: 1 },
    muzzleVelocity: 410,
    projectile: false,
    magazine: 6,
    reserve: 48,
    tubeFed: true,                // shell-by-shell reload
    spread: { hip: 4.4, ads: 2.6, moveAdd: 1.1, crouchMul: 0.82, airAdd: 2.4, sprintAdd: 2.0 },
    /** Pellets are laid out on rings so the pattern is a believable donut,
     *  not a random blob. [radiusFraction, count] */
    pattern: [[0.0, 1], [0.58, 3], [1.0, 4]],
    bloom: { perShot: 0.55, max: 2.0, decay: 3.0, adsMul: 0.5 },
    recoil: {
      pattern: [[3.10, 0.35], [3.30, -0.42], [3.20, 0.50], [3.35, -0.30], [3.15, 0.28], [3.30, -0.48]],
      randomness: 0.42,
      adsMul: 0.85,
      recovery: 0.80,
      recoverySpeed: 5.2,
      vmKick: { back: 0.082, up: 0.030, pitch: 13.5, yaw: 2.6, roll: 5.5 },
      shake: { amp: 0.9, freq: 18, dur: 0.20 },
    },
    ads: { time: 0.28, fovScale: 0.90, vmFovScale: 0.96, sensScale: 0.85 },
    reload: { tactical: 0.62, empty: 0.62, shell: 0.44, open: 0.42, close: 0.46 },
    swap: { out: 0.34, in: 0.50 },
    shell: { type: 'shotgun', velocity: [2.0, 1.9, 0.3], spinScale: 0.7 },
    crosshair: { base: 22, thickness: 2 },
    tracerEvery: 0,
    optic: 'irons',
    ammoType: '12 GA',
  },

  // ───────────────────────────────────────────────── marksman rifle ────────
  dmr: {
    id: 'dmr',
    name: 'LR-8 LONGREACH',
    kind: 'dmr',
    slot: 2,
    model: 'dmr',
    fireMode: 'semi',
    rpm: 300,
    pellets: 1,
    damage: curve([[0, 68], [60, 68], [110, 55], [180, 44]]),
    headshotMul: 2.4,
    armorPen: 0.75,
    penetration: { maxThickness: 0.34, damageScale: 0.78, maxSurfaces: 3 },
    muzzleVelocity: 860,
    projectile: true,             // true simulated projectile with drop
    gravityScale: 1.0,            // real drop, ~2 cm at 60 m — subtle but honest
    magazine: 10,
    reserve: 60,
    spread: { hip: 3.2, ads: 0.02, moveAdd: 2.2, crouchMul: 0.5, airAdd: 4.5, sprintAdd: 3.5 },
    bloom: { perShot: 0.9, max: 4.0, decay: 3.4, adsMul: 0.12 },
    recoil: {
      pattern: [[2.30, -0.16], [2.45, 0.24], [2.35, -0.30], [2.50, 0.18], [2.40, 0.30],
                [2.55, -0.22], [2.42, 0.26], [2.60, -0.18], [2.48, 0.14], [2.52, -0.26]],
      randomness: 0.18,
      adsMul: 0.66,
      recovery: 0.90,
      recoverySpeed: 6.0,
      vmKick: { back: 0.062, up: 0.021, pitch: 10.0, yaw: 1.9, roll: 3.4 },
      shake: { amp: 0.62, freq: 20, dur: 0.15 },
    },
    ads: { time: 0.34, fovScale: 0.42, vmFovScale: 0.74, sensScale: 0.46, scoped: true },
    reload: { tactical: 2.1, empty: 2.85, magOut: 0.5, magIn: 1.12, chargeAt: 2.24 },
    swap: { out: 0.38, in: 0.55 },
    shell: { type: 'rifle', velocity: [3.1, 1.7, 0.5], spinScale: 1.2 },
    crosshair: { base: 12, thickness: 2 },
    tracerEvery: 1,
    optic: 'scope',
    ammoType: '7.62×51',
  },

  // ───────────────────────────────────────────────────────────── pistol ────
  pistol: {
    id: 'pistol',
    name: 'M9 SIDEWINDER',
    kind: 'pistol',
    slot: 3,
    model: 'pistol',
    fireMode: 'semi',
    rpm: 460,
    pellets: 1,
    damage: curve([[0, 24], [16, 24], [34, 16], [55, 12]]),
    headshotMul: 2.1,
    armorPen: 0.2,
    penetration: { maxThickness: 0.07, damageScale: 0.45, maxSurfaces: 1 },
    muzzleVelocity: 390,
    projectile: false,
    magazine: 15,
    reserve: 90,
    spread: { hip: 1.6, ads: 0.30, moveAdd: 1.1, crouchMul: 0.7, airAdd: 2.6, sprintAdd: 2.2 },
    bloom: { perShot: 0.36, max: 2.6, decay: 6.4, adsMul: 0.4 },
    recoil: {
      pattern: [[1.55, 0.10], [1.62, -0.22], [1.58, 0.26], [1.66, 0.14], [1.60, -0.28],
                [1.70, 0.20], [1.64, -0.12], [1.72, 0.24], [1.66, -0.26], [1.74, 0.16]],
      randomness: 0.34,
      adsMul: 0.80,
      recovery: 0.88,
      recoverySpeed: 9.5,
      vmKick: { back: 0.036, up: 0.014, pitch: 7.2, yaw: 2.2, roll: 3.0 },
      shake: { amp: 0.30, freq: 30, dur: 0.08 },
    },
    ads: { time: 0.145, fovScale: 0.86, vmFovScale: 0.95, sensScale: 0.85 },
    reload: { tactical: 1.5, empty: 2.15, magOut: 0.34, magIn: 0.82, chargeAt: 1.66 },
    swap: { out: 0.22, in: 0.30 },
    shell: { type: 'pistol', velocity: [2.3, 1.6, 0.3], spinScale: 0.9 },
    crosshair: { base: 8, thickness: 2 },
    tracerEvery: 4,
    optic: 'irons',
    ammoType: '9×19',
  },
};

/** Convert authored degrees → radians once, and freeze the result. */
function bake(def) {
  const d = { ...def };
  d.spread = {
    hip: def.spread.hip * D,
    ads: def.spread.ads * D,
    moveAdd: def.spread.moveAdd * D,
    crouchMul: def.spread.crouchMul,
    airAdd: def.spread.airAdd * D,
    sprintAdd: def.spread.sprintAdd * D,
  };
  d.bloom = { ...def.bloom, perShot: def.bloom.perShot * D, max: def.bloom.max * D };
  d.recoil = {
    ...def.recoil,
    pattern: def.recoil.pattern.map(([p, y]) => [p * D, y * D]),
    vmKick: {
      back: def.recoil.vmKick.back,
      up: def.recoil.vmKick.up,
      pitch: def.recoil.vmKick.pitch * D,
      yaw: def.recoil.vmKick.yaw * D,
      roll: def.recoil.vmKick.roll * D,
    },
  };
  d.shotInterval = 60 / def.rpm;
  return d;
}

export const WEAPON_DEFS = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, bake(v)]));

/** Default loadout order — also the 1..4 key order. */
export const LOADOUT = ['ar', 'shotgun', 'dmr', 'pistol'];

export function getDef(id) { return WEAPON_DEFS[id] || WEAPON_DEFS.ar; }

export { curve as damageCurve, D as DEG };
