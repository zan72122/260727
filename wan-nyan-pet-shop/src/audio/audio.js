/**
 * All sound is synthesised with the Web Audio API — no audio files.
 * The context is created lazily on the first user gesture (browser autoplay
 * policy) and every entry point is guarded so headless runs never throw.
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuffer = null;
    this.failed = false;
  }

  /** Must be called from a user gesture handler. Safe to call repeatedly. */
  unlock() {
    if (this.ctx || this.failed) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) {
      this.failed = true;
      return;
    }
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.32;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.4);
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (err) {
      console.warn('[audio] unavailable', err);
      this.failed = true;
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.32;
  }

  get ready() {
    return Boolean(this.ctx && this.master && !this.muted);
  }

  _tone({ freq = 440, type = 'sine', dur = 0.18, gain = 0.3, slideTo = null, delay = 0, attack = 0.01 }) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise({ dur = 0.2, gain = 0.2, freq = 1200, q = 1, delay = 0, sweepTo = null }) {
    if (!this.ready || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t0);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  click() {
    this._tone({ freq: 660, type: 'triangle', dur: 0.08, gain: 0.18 });
  }

  error() {
    this._tone({ freq: 210, type: 'square', dur: 0.14, gain: 0.12, slideTo: 150 });
  }

  bark() {
    this._tone({ freq: 320, type: 'sawtooth', dur: 0.11, gain: 0.22, slideTo: 190 });
    this._noise({ dur: 0.09, gain: 0.1, freq: 900, q: 0.8 });
    this._tone({ freq: 290, type: 'sawtooth', dur: 0.1, gain: 0.18, slideTo: 175, delay: 0.16 });
  }

  meow() {
    this._tone({ freq: 520, type: 'sawtooth', dur: 0.42, gain: 0.16, slideTo: 780, attack: 0.06 });
    this._tone({ freq: 1040, type: 'sine', dur: 0.4, gain: 0.05, slideTo: 700 });
  }

  chomp() {
    this._noise({ dur: 0.1, gain: 0.16, freq: 420, q: 2 });
    this._noise({ dur: 0.1, gain: 0.14, freq: 320, q: 2, delay: 0.14 });
  }

  brush() {
    this._noise({ dur: 0.3, gain: 0.13, freq: 2400, q: 0.7, sweepTo: 900 });
  }

  purr() {
    this._tone({ freq: 300, type: 'sine', dur: 0.3, gain: 0.14, slideTo: 420 });
    this._tone({ freq: 600, type: 'sine', dur: 0.3, gain: 0.06, slideTo: 840, delay: 0.05 });
  }

  sweep() {
    this._noise({ dur: 0.22, gain: 0.14, freq: 700, q: 0.6, sweepTo: 2200 });
  }

  coin() {
    this._tone({ freq: 880, type: 'triangle', dur: 0.12, gain: 0.22 });
    this._tone({ freq: 1320, type: 'triangle', dur: 0.22, gain: 0.18, delay: 0.09 });
  }

  jingle() {
    [523, 659, 784, 1047].forEach((f, i) => {
      this._tone({ freq: f, type: 'triangle', dur: 0.26, gain: 0.18, delay: i * 0.11 });
    });
  }

  sad() {
    [440, 392, 330].forEach((f, i) => {
      this._tone({ freq: f, type: 'sine', dur: 0.32, gain: 0.16, delay: i * 0.18 });
    });
  }

  bell() {
    this._tone({ freq: 1180, type: 'sine', dur: 0.3, gain: 0.14 });
    this._tone({ freq: 1580, type: 'sine', dur: 0.24, gain: 0.08, delay: 0.06 });
  }
}
