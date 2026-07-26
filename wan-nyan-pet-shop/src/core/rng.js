/**
 * Deterministic, serialisable pseudo-random number generator (mulberry32).
 * The whole simulation draws from one of these so a seed fully reproduces a run,
 * which is what makes the unit tests meaningful.
 */
export class Rng {
  constructor(seed = 1) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** float in [0,1) */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** float in [min,max) */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** integer in [min,max] inclusive */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  pick(arr) {
    return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))];
  }

  chance(p) {
    return this.next() < p;
  }

  serialize() {
    return this.state >>> 0;
  }

  static deserialize(state) {
    const r = new Rng(1);
    r.state = state >>> 0;
    return r;
  }
}
