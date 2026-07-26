import * as THREE from 'three';

/**
 * Installs `window.__QA__` so the headless capture harness can pose the camera
 * at fixed viewpoints. Purely additive — has no effect unless driven externally.
 */
export function installDebugHooks(ctx) {
  const lookTarget = new THREE.Vector3();
  let override = null;

  const qa = {
    /** Pose the camera for a named shot. `cfg.pos === null` keeps the player view. */
    setShot(name, cfg = {}) {
      if (cfg.fov) { ctx.camera.fov = cfg.fov; ctx.camera.updateProjectionMatrix(); }
      if (cfg.enemies && ctx.ai?.spawnWave) ctx.ai.spawnWave(6);
      if (!cfg.pos) { override = null; qa.freeze = false; return; }
      override = { pos: new THREE.Vector3(...cfg.pos), look: new THREE.Vector3(...(cfg.look || [0, 1.6, 0])) };
      qa.freeze = true;
    },
    freeze: false,
    /** Applied from a lateUpdate hook so it wins over the player controller. */
    apply() {
      if (!override) return;
      ctx.camera.position.copy(override.pos);
      lookTarget.copy(override.look);
      ctx.camera.lookAt(lookTarget);
    },
    stats() {
      const r = ctx.renderer?.info;
      return { fps: ctx.clock.fps, calls: r?.render.calls, tris: r?.render.triangles,
               geometries: r?.memory.geometries, textures: r?.memory.textures };
    },
    setQuality(q) { ctx.settings.setQuality(q); },
    teleport(x, y, z) { ctx.player?.position.set(x, y, z); },
    ctx,
  };

  window.__QA__ = qa;
  return qa;
}

/** System wrapper — runs after everything else but before the renderer. */
export class QASystem {
  constructor() { this.name = 'qa'; this.priority = 990; }
  init(ctx) { this.qa = installDebugHooks(ctx); }
  lateUpdate() { this.qa.apply(); }
}
