/**
 * Global quality / gameplay settings. Systems read from `Settings` at build time
 * and subscribe to `Settings.onChange` for live-tunable values.
 */
const listeners = new Set();

const PRESETS = {
  low:    { shadowMap: 1024, ssao: false, bloom: true,  taa: false, motionBlur: false, dof: false,
            particleBudget: 900,  decalBudget: 96,  anisotropy: 4,  textureSize: 512,  ssr: false, volumetrics: false },
  medium: { shadowMap: 2048, ssao: true,  bloom: true,  taa: true,  motionBlur: false, dof: false,
            particleBudget: 2200, decalBudget: 192, anisotropy: 8,  textureSize: 1024, ssr: false, volumetrics: true },
  high:   { shadowMap: 3072, ssao: true,  bloom: true,  taa: true,  motionBlur: true,  dof: true,
            particleBudget: 4000, decalBudget: 320, anisotropy: 16, textureSize: 1024, ssr: true,  volumetrics: true },
  ultra:  { shadowMap: 4096, ssao: true,  bloom: true,  taa: true,  motionBlur: true,  dof: true,
            particleBudget: 6000, decalBudget: 512, anisotropy: 16, textureSize: 2048, ssr: true,  volumetrics: true },
};

export const Settings = {
  quality: 'high',
  ...PRESETS.high,

  // Rendering
  exposure: 1.0,
  fov: 82,
  adsFovScale: 0.72,
  renderScale: 1.0,

  // Input
  sensitivity: 0.0022,
  adsSensitivityScale: 0.62,
  invertY: false,

  // Accessibility / feel
  viewBobScale: 1.0,
  screenShakeScale: 1.0,
  reducedMotion: false,

  // Audio
  masterVolume: 0.85,
  sfxVolume: 1.0,
  musicVolume: 0.5,

  setQuality(name) {
    if (!PRESETS[name]) return;
    this.quality = name;
    Object.assign(this, PRESETS[name]);
    this.emit('quality');
  },
  set(key, value) {
    this[key] = value;
    this.emit(key);
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit(key) { for (const fn of listeners) fn(key, this); },
};

export { PRESETS };
