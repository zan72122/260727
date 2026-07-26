import { EventBus } from './core/events.js';
import { Loop } from './core/loop.js';
import { LAYOUT, ACTIONS } from './game/balance.js';
import {
  PHASES, createGame, step, interact, setTool, startGame, nextDay, openShopScreen,
  buyUpgrade, restock, continueAfterEnding, closeDay,
} from './game/state.js';
import { saveGame, loadGame, hasSave, clearSave } from './game/save.js';
import { Renderer } from './render/renderer.js';
import { Particles } from './render/fx.js';
import { Audio } from './audio/audio.js';

const canvas = document.getElementById('game');
const bus = new EventBus();
const audio = new Audio();
const particles = new Particles();
const renderer = new Renderer(canvas);

let state = createGame({ seed: (Date.now() % 100000) + 7, bus });

const ui = {
  pointer: null,
  hoverId: null,
  speed: 1,
  muted: false,
  paused: false,
  hasSave: hasSave(),
};

/**
 * Rolling frame statistics. `frame` is the wall-clock interval between frames
 * (vsync-bound, so it tops out at the display rate); `render` and `sim` are the
 * actual work done per frame, which is what tells us how much headroom is left.
 */
class Ring {
  constructor(size = 300) {
    this.values = new Float32Array(size);
    this.index = 0;
    this.count = 0;
  }

  push(ms) {
    this.values[this.index] = ms;
    this.index = (this.index + 1) % this.values.length;
    this.count = Math.min(this.count + 1, this.values.length);
  }

  reset() {
    this.index = 0;
    this.count = 0;
  }

  stats() {
    const n = this.count;
    if (!n) return { avgMs: 0, p95Ms: 0, worstMs: 0, samples: 0 };
    const arr = Array.prototype.slice.call(this.values, 0, n).sort((a, b) => a - b);
    const sum = arr.reduce((s, v) => s + v, 0);
    return {
      avgMs: +(sum / n).toFixed(3),
      p95Ms: +arr[Math.min(n - 1, Math.floor(n * 0.95))].toFixed(3),
      worstMs: +arr[n - 1].toFixed(3),
      samples: n,
    };
  }
}

const perf = {
  frame: new Ring(),
  render: new Ring(),
  sim: new Ring(),
  push(ms) {
    this.frame.push(ms);
  },
  reset() {
    this.frame.reset();
    this.render.reset();
    this.sim.reset();
  },
  summary() {
    const frame = this.frame.stats();
    const render = this.render.stats();
    const sim = this.sim.stats();
    return {
      fps: frame.avgMs ? Math.round(1000 / frame.avgMs) : 0,
      avgMs: frame.avgMs,
      p95Ms: frame.p95Ms,
      worstMs: frame.worstMs,
      samples: frame.samples,
      renderMs: render.avgMs,
      renderP95Ms: render.p95Ms,
      renderWorstMs: render.worstMs,
      simMs: sim.avgMs,
      simP95Ms: sim.p95Ms,
      // How many 60 Hz budgets (16.67 ms) the frame's own work consumes.
      budgetUsedPct: +(((render.avgMs + sim.avgMs) / 16.67) * 100).toFixed(1),
    };
  },
};

let autosaveTimer = 0;
let time = 0;

/* ---------------------------------------------------------------- */
/* Feedback: sound + particles react to simulation events            */
/* ---------------------------------------------------------------- */

bus.on('care', ({ pet, action, gentle }) => {
  const { x, y } = pet.pos;
  if (action === 'feed') {
    particles.burstCrumbs(x, y - 18, 7);
    audio.chomp();
  } else if (action === 'brush') {
    particles.burstSparkles(x, y - 34, 8, '#bfe6ff');
    audio.brush();
  } else if (action === 'play') {
    particles.burstHearts(x, y - 30, 5);
    particles.burstSparkles(x, y - 40, 5, '#ffe9a8');
    if (pet.species === 'dog') audio.bark();
    else audio.meow();
  } else if (action === 'pet') {
    particles.burstHearts(x, y - 28, gentle ? 1 : 3);
    if (gentle) audio.bell();
    else if (pet.species === 'dog') audio.bark();
    else audio.purr();
  }
});
bus.on('care-fail', () => audio.error());
bus.on('clean', ({ x, y }) => {
  particles.burstSparkles(x, y, 9, '#c8f0dd');
  audio.sweep();
});
bus.on('adopt', ({ pet, price }) => {
  particles.burstHearts(pet.pos.x, pet.pos.y - 30, 10);
  particles.floatText(pet.pos.x, pet.pos.y - 70, `+${price}円`);
  audio.coin();
});
bus.on('vet', ({ pet }) => {
  particles.floatText(pet.pos.x, pet.pos.y - 70, '-600円', '#e8695f');
  audio.sad();
});
bus.on('arrival', ({ pet }) => {
  particles.burstSparkles(pet.pos.x, pet.pos.y - 30, 12, '#ffd9e0');
  audio.bell();
});
bus.on('customer-enter', () => audio.bell());
bus.on('purchase', () => audio.coin());
bus.on('day-end', () => {
  audio.jingle();
  ui.hasSave = saveGame(state);
});
bus.on('goal', () => audio.jingle());
bus.on('gameover', () => {
  audio.sad();
  clearSave();
  ui.hasSave = false;
});

/* ---------------------------------------------------------------- */
/* Input                                                             */
/* ---------------------------------------------------------------- */

function pointerPos(ev) {
  return renderer.toWorld(ev.clientX, ev.clientY);
}

canvas.addEventListener('pointermove', (ev) => {
  ui.pointer = pointerPos(ev);
  const hit = renderer.regions.hit(ui.pointer.x, ui.pointer.y);
  ui.hoverId = hit ? hit.id : null;
  canvas.style.cursor = hit && hit.id !== 'petcard' ? 'pointer' : 'default';
});

canvas.addEventListener('pointerleave', () => {
  ui.pointer = null;
  ui.hoverId = null;
});

canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  audio.unlock();
  const p = pointerPos(ev);
  ui.pointer = p;
  handleClick(p.x, p.y);
});

function handleClick(x, y) {
  const hit = renderer.regions.hit(x, y);
  if (hit && handleRegion(hit)) return;

  if (state.phase !== PHASES.OPEN || ui.paused) return;
  if (y < LAYOUT.TOP_BAR_H || y > LAYOUT.HEIGHT - LAYOUT.TOOL_BAR_H) return;
  if (hit && hit.id === 'petcard') return;
  interact(state, x, y);
}

function handleRegion(hit) {
  const id = hit.id;
  if (id.startsWith('tool:')) {
    setTool(state, hit.data);
    audio.click();
    return true;
  }
  if (id.startsWith('btn:buy:')) {
    const res = buyUpgrade(state, id.slice('btn:buy:'.length));
    if (!res.ok) audio.error();
    return true;
  }
  switch (id) {
    case 'ui:speed':
      ui.speed = ui.speed === 1 ? 2 : 1;
      loop.speed = ui.speed;
      audio.click();
      return true;
    case 'ui:mute':
      ui.muted = !ui.muted;
      audio.setMuted(ui.muted);
      audio.click();
      return true;
    case 'ui:pause':
      togglePause();
      return true;
    case 'btn:start':
      startGame(state);
      audio.click();
      return true;
    case 'btn:continue': {
      const loaded = loadGame(globalThis.localStorage, { bus });
      if (loaded) {
        state = loaded;
        state.bus = bus;
        if (state.phase === PHASES.TITLE) startGame(state);
      }
      audio.click();
      return true;
    }
    case 'btn:toshop':
      openShopScreen(state);
      audio.click();
      return true;
    case 'btn:restock': {
      const res = restock(state);
      if (!res.ok) audio.error();
      return true;
    }
    case 'btn:open':
      nextDay(state);
      audio.click();
      ui.hasSave = saveGame(state);
      return true;
    case 'btn:keepgoing':
      continueAfterEnding(state);
      audio.click();
      return true;
    case 'btn:retry':
      state = createGame({ seed: (Date.now() % 100000) + 13, bus });
      startGame(state);
      particles.clear();
      audio.click();
      return true;
    case 'btn:resume':
      togglePause();
      return true;
    case 'btn:save':
      ui.hasSave = saveGame(state);
      togglePause();
      state.phase = PHASES.TITLE;
      audio.click();
      return true;
    default:
      return false;
  }
}

function togglePause() {
  ui.paused = !ui.paused;
  loop.setPaused(ui.paused);
  audio.click();
  if (ui.paused) ui.hasSave = saveGame(state);
}

globalThis.addEventListener('keydown', (ev) => {
  const key = ev.key;
  const tool = Object.values(ACTIONS).find((a) => a.key === key);
  if (tool) {
    setTool(state, tool.id);
    audio.click();
    return;
  }
  if (key === 'Escape') {
    if (state.phase === PHASES.OPEN) togglePause();
  } else if (key === ' ') {
    ev.preventDefault();
    if (state.phase === PHASES.TITLE) startGame(state);
    else if (state.phase === PHASES.REPORT) openShopScreen(state);
    else if (state.phase === PHASES.SHOP) nextDay(state);
    else if (state.phase === PHASES.ENDING) continueAfterEnding(state);
  } else if (key === 'm' || key === 'M') {
    ui.muted = !ui.muted;
    audio.setMuted(ui.muted);
  }
});

globalThis.addEventListener('resize', () => renderer.resize());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !ui.paused) loop.setPaused(true);
  else if (!document.hidden && !ui.paused) loop.setPaused(false);
});

/* ---------------------------------------------------------------- */
/* Loop                                                              */
/* ---------------------------------------------------------------- */

const loop = new Loop(
  (dt) => {
    const t0 = performance.now();
    time += dt;
    step(state, dt);
    particles.update(dt);
    perf.sim.push(performance.now() - t0);
    if (state.phase === PHASES.OPEN) {
      autosaveTimer += dt;
      if (autosaveTimer > 30) {
        autosaveTimer = 0;
        ui.hasSave = saveGame(state);
      }
    }
  },
  (alpha, frameDt) => {
    perf.push(frameDt * 1000);
    const t0 = performance.now();
    renderer.render(state, ui, particles, time);
    perf.render.push(performance.now() - t0);
  },
);

loop.start();

/* ---------------------------------------------------------------- */
/* QA / automation hooks                                             */
/* ---------------------------------------------------------------- */

globalThis.__WANNYAN__ = {
  get state() {
    return state;
  },
  get ui() {
    return ui;
  },
  perf,
  loop,
  renderer,
  particles,
  bus,
  PHASES,
  setSpeed(v) {
    ui.speed = v;
    loop.speed = v;
  },
  setMuted(v) {
    ui.muted = v;
    audio.setMuted(v);
  },
  start() {
    startGame(state);
  },
  click(x, y) {
    handleClick(x, y);
  },
  setTool(t) {
    setTool(state, t);
  },
  /** Advance the simulation without waiting for real time (tests/benchmarks). */
  simulate(seconds, dt = 1 / 30) {
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) {
      step(state, dt);
      particles.update(dt);
      time += dt;
    }
  },
  endDay() {
    return closeDay(state);
  },
  reset(seed = 20260727) {
    state = createGame({ seed, bus });
    particles.clear();
    return state;
  },
  version: '1.0.0',
};

document.getElementById('boot')?.remove();
