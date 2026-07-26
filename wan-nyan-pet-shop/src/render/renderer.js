import { LAYOUT } from '../game/balance.js';
import { PHASES, shopCleanliness, capacity } from '../game/state.js';
import { buildRoomLayer } from './room.js';
import { drawPet, drawPetBubble, drawCustomer, drawMess, drawBed } from './sprites.js';
import { Regions, drawTopBar, drawToolbar, drawPetCard, drawLogTicker, drawHint } from './hud.js';
import { drawTitle, drawReport, drawShopScreen, drawEnding, drawGameOver, drawPause } from './overlays.js';
import { C, font, roundRect } from './palette.js';

const W = LAYOUT.WIDTH;
const H = LAYOUT.HEIGHT;
const MAX_DPR = 2;

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  throw new Error('no canvas factory available');
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.regions = new Regions();
    this.dpr = 1;
    this.roomLayer = buildRoomLayer(makeCanvas);
    this.resize();
  }

  resize() {
    const dpr = Math.min(MAX_DPR, globalThis.devicePixelRatio || 1);
    this.dpr = dpr;
    const pw = Math.round(W * dpr);
    const ph = Math.round(H * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
  }

  /** Convert a pointer event position to logical game coordinates. */
  toWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  render(state, ui, particles, time) {
    const ctx = this.ctx;
    this.regions.clear();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.roomLayer, 0, 0, W, H);

    const playable = state.phase === PHASES.OPEN;
    drawBeds(ctx, state);

    for (const mess of state.messes) {
      drawMess(ctx, mess, playable && state.tool === 'clean' && near(ui.pointer, mess, 30));
    }

    const actors = [];
    for (const pet of state.pets) actors.push({ y: pet.pos.y, pet });
    for (const cus of state.customers) actors.push({ y: cus.pos.y, cus });
    actors.sort((a, b) => a.y - b.y);

    const hoverPet = playable ? nearestPet(state, ui.pointer) : null;
    for (const a of actors) {
      if (a.pet) {
        drawPet(ctx, a.pet, time, {
          selected: a.pet.id === state.selectedPetId,
          hovered: hoverPet === a.pet,
        });
      } else {
        drawCustomer(ctx, a.cus, time);
      }
    }
    for (const pet of state.pets) drawPetBubble(ctx, pet, time);

    particles.draw(ctx);

    if (state.phase !== PHASES.TITLE) {
      drawTopBar(ctx, state, this.regions, ui);
      drawToolbar(ctx, state, this.regions, ui);
      drawPetCard(ctx, state, this.regions, time);
      drawLogTicker(ctx, state);
      drawHint(ctx, state);
      drawDirtyWarning(ctx, state);
    }

    switch (state.phase) {
      case PHASES.TITLE:
        drawTitle(ctx, this.regions, ui, time, ui.hasSave);
        break;
      case PHASES.REPORT:
        drawReport(ctx, state, this.regions, ui);
        break;
      case PHASES.SHOP:
        drawShopScreen(ctx, state, this.regions, ui);
        break;
      case PHASES.ENDING:
        drawEnding(ctx, state, this.regions, ui, time);
        break;
      case PHASES.GAMEOVER:
        drawGameOver(ctx, state, this.regions, ui);
        break;
      default:
        if (ui.paused) drawPause(ctx, this.regions, ui);
        break;
    }
    return this.regions;
  }
}

function drawBeds(ctx, state) {
  const n = capacity(state);
  // Beds line the back wall, stopping short of the door on the right.
  const startX = LAYOUT.FLOOR.x + 96;
  const span = LAYOUT.FLOOR.w - 300;
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? startX + span / 2 : startX + (span / (n - 1)) * i;
    drawBed(ctx, x, LAYOUT.FLOOR.y + 4, i);
  }
}

function drawDirtyWarning(ctx, state) {
  const clean = shopCleanliness(state);
  if (clean > 45 || state.phase !== PHASES.OPEN) return;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(232,105,95,0.92)';
  const text = '店内がよごれています！ おそうじしよう';
  ctx.font = font(13, 800);
  const w = ctx.measureText(text).width + 26;
  const x = (W - w) / 2;
  // Sits just above the toolbar: the shop sign owns the top of the wall.
  const y = LAYOUT.HEIGHT - LAYOUT.TOOL_BAR_H - 40;
  roundRect(ctx, x, y, w, 26, 13);
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, y + 14);
  ctx.restore();
}

function near(pointer, obj, r) {
  if (!pointer) return false;
  return Math.hypot(pointer.x - obj.x, pointer.y - obj.y) < r;
}

function nearestPet(state, pointer) {
  if (!pointer) return null;
  let best = null;
  let bestD = 52;
  for (const pet of state.pets) {
    const d = Math.hypot(pet.pos.x - pointer.x, pet.pos.y - pointer.y - 10);
    if (d < bestD) {
      bestD = d;
      best = pet;
    }
  }
  return best;
}
