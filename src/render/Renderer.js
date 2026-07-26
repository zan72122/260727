import * as THREE from 'three';
import { Settings } from '../core/Settings.js';

/**
 * Owns the WebGLRenderer and the frame's final draw call.
 *
 * Draw order contract: this system runs LAST (priority 1000). If a PostFX system
 * is present it exposes `ctx.postfx.render(dt)` and we defer to it; otherwise we
 * do a straight forward render. Nothing else in the codebase may call
 * `renderer.render()` for the main pass.
 */
export class RendererSystem {
  constructor() {
    this.name = 'renderer';
    this.priority = 1000;
    this.renderer = null;
  }

  init(ctx) {
    const renderer = new THREE.WebGLRenderer({
      antialias: !Settings.taa,          // TAA/SMAA supersedes MSAA when enabled
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
      depth: true,
      preserveDrawingBuffer: true,       // needed for screenshot-based QA capture
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * Settings.renderScale);
    renderer.setSize(ctx.container.clientWidth || window.innerWidth, ctx.container.clientHeight || window.innerHeight);

    // --- Colour pipeline -------------------------------------------------
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;   // filmic, neutral highlights
    renderer.toneMappingExposure = Settings.exposure;

    // --- Shadows ---------------------------------------------------------
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.shadowMap.autoUpdate = true;

    renderer.debug.checkShaderErrors = import.meta.env?.DEV ?? false;

    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.style.outline = 'none';
    ctx.container.appendChild(canvas);

    this.renderer = renderer;
    ctx.renderer = renderer;
    ctx.canvas = canvas;

    // Expose a capability report so quality systems can degrade gracefully.
    const gl = renderer.getContext();
    ctx.caps = {
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      floatLinear: !!gl.getExtension('OES_texture_float_linear'),
      colorBufferFloat: !!gl.getExtension('EXT_color_buffer_float'),
    };
    Settings.anisotropy = Math.min(Settings.anisotropy, ctx.caps.maxAnisotropy);

    Settings.onChange((key) => {
      if (key === 'exposure') renderer.toneMappingExposure = Settings.exposure;
      if (key === 'renderScale') this.resize(ctx.container.clientWidth, ctx.container.clientHeight, ctx);
    });

    this._ctx = ctx;
  }

  resize(w, h, ctx) {
    if (!this.renderer) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * Settings.renderScale);
    this.renderer.setSize(w, h, false);
    const c = this.renderer.domElement;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
  }

  lateUpdate(dt, ctx) {
    if (ctx.postfx?.render) ctx.postfx.render(dt, ctx);
    else this.renderer.render(ctx.scene, ctx.camera);
  }

  dispose() { this.renderer?.dispose(); }
}
