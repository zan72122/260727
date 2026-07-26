import { Engine } from './core/Engine.js';
import { Settings } from './core/Settings.js';
import { bus, EV } from './core/EventBus.js';

import { RendererSystem } from './render/Renderer.js';
import { SkySystem } from './render/Sky.js';
import { PostFXSystem } from './render/PostFX.js';
import { LevelSystem } from './world/Level.js';
import { PhysicsSystem } from './physics/Physics.js';
import { PlayerSystem } from './player/Player.js';
import { WeaponSystem } from './weapons/WeaponSystem.js';
import { AISystem } from './ai/AISystem.js';
import { FXSystem } from './fx/FXSystem.js';
import { AudioSystem } from './audio/AudioEngine.js';
import { UISystem } from './ui/UISystem.js';
import { GameDirector } from './game/GameDirector.js';
import { QASystem } from './qa/DebugHooks.js';

const container = document.getElementById('app');
const engine = new Engine(container);

// Renderer must init first (everything else needs ctx.renderer), then the world
// spine, then gameplay, then presentation. Engine sorts by `priority` for the
// update loop; boot order follows insertion order here.
engine.add(new RendererSystem());
engine.add(new SkySystem());
engine.add(new LevelSystem());
engine.add(new PhysicsSystem());
engine.add(new PlayerSystem());
engine.add(new WeaponSystem());
engine.add(new AISystem());
engine.add(new FXSystem());
engine.add(new AudioSystem());
engine.add(new GameDirector());
engine.add(new UISystem());
engine.add(new PostFXSystem());
engine.add(new QASystem());

// Boot order for init() is insertion order, but the update loop needs
// renderer last — Engine.add() re-sorts by priority for updates only.
(async () => {
  try {
    await engine.init();
    engine.start();
    window.__GAME__ = { engine, Settings, bus, EV };
    window.dispatchEvent(new CustomEvent('game:ready'));
  } catch (err) {
    console.error('[boot] fatal', err);
    container.innerHTML =
      `<div style="position:absolute;inset:0;display:grid;place-items:center;padding:40px;
        font:14px/1.6 ui-monospace,monospace;color:#ff6b6b;background:#0a0c10;white-space:pre-wrap">
        Boot failure:\n\n${(err && err.stack) || err}</div>`;
    window.__BOOT_ERROR__ = String((err && err.stack) || err);
  }
})();
