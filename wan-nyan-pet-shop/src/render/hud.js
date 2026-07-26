import { C, font, roundRect } from './palette.js';
import { ACTIONS, LAYOUT, DAY } from '../game/balance.js';
import { condition, moodOf, isAdoptable } from '../game/pets.js';
import { shopCleanliness, capacity } from '../game/state.js';
import { drawNeedIcon, breedOf, drawHeart } from './sprites.js';
import { personalityById } from '../game/data.js';

const W = LAYOUT.WIDTH;
const H = LAYOUT.HEIGHT;

/** Rect registry rebuilt every frame; input hit-tests against it. */
export class Regions {
  constructor() {
    this.list = [];
  }

  clear() {
    this.list.length = 0;
  }

  add(id, x, y, w, h, data = null) {
    this.list.push({ id, x, y, w, h, data });
  }

  hit(x, y) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  }
}

export function formatMoney(n) {
  const v = Math.round(n);
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${v < 0 ? '-' : ''}${s}円`;
}

export function drawTopBar(ctx, state, regions, ui) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,252,246,0.96)';
  ctx.fillRect(0, 0, W, LAYOUT.TOP_BAR_H);
  ctx.fillStyle = C.panelEdge;
  ctx.fillRect(0, LAYOUT.TOP_BAR_H - 3, W, 3);

  ctx.textBaseline = 'middle';
  const midY = LAYOUT.TOP_BAR_H / 2;

  // day badge
  ctx.fillStyle = C.pink;
  roundRect(ctx, 12, 10, 78, 38, 12);
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.font = font(18);
  ctx.textAlign = 'center';
  ctx.fillText(`${state.day}日目`, 51, midY + 1);

  // opening-hours bar
  const bx = 98;
  const bw = 172;
  ctx.fillStyle = '#efe2d1';
  roundRect(ctx, bx, 22, bw, 18, 9);
  ctx.fill();
  const p = Math.min(1, state.timeInDay / state.dayLength);
  const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  g.addColorStop(0, '#ffd88a');
  g.addColorStop(1, '#ff9e6d');
  ctx.fillStyle = g;
  roundRect(ctx, bx, 22, Math.max(6, bw * p), 18, 9);
  ctx.fill();
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(10, 700);
  ctx.textAlign = 'left';
  ctx.fillText('えいぎょう時間', bx + 2, 13);
  ctx.textAlign = 'right';
  const left = Math.max(0, Math.ceil(state.dayLength - state.timeInDay));
  ctx.fillText(`のこり ${left}秒`, bx + bw - 2, 13);

  // money
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = font(19);
  ctx.fillText(formatMoney(state.money), 284, midY);

  meterWithLabel(ctx, {
    x: 414, label: '評判', width: 132,
    ratio: Math.min(1, state.reputation / DAY.GOAL_REPUTATION),
    color: C.mint,
    text: `${Math.round(state.reputation)} / ${DAY.GOAL_REPUTATION}`,
  });

  const clean = shopCleanliness(state);
  meterWithLabel(ctx, {
    x: 562, label: '店内のきれいさ', width: 112,
    ratio: clean / 100,
    color: clean > 60 ? '#8ec9ea' : clean > 30 ? C.gold : C.red,
    text: `${Math.round(clean)}`,
  });

  // pets / capacity
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(10, 700);
  ctx.textAlign = 'left';
  ctx.fillText('ペット', 690, 13);
  ctx.fillStyle = C.ink;
  ctx.font = font(16);
  ctx.fillText(`${state.pets.length} / ${capacity(state)}`, 690, 33);

  // buttons
  smallButton(ctx, regions, 'ui:speed', W - 158, 12, 44, 34, `x${ui.speed}`);
  smallButton(ctx, regions, 'ui:mute', W - 108, 12, 44, 34, ui.muted ? '♪ ×' : '♪', ui.muted);
  smallButton(ctx, regions, 'ui:pause', W - 58, 12, 44, 34, ui.paused ? '▶' : 'II');
  ctx.restore();
}

/** A labelled meter with its value printed inside the bar (saves header space). */
function meterWithLabel(ctx, { x, label, width, ratio, color, text }) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(10, 700);
  ctx.fillText(label, x, 13);
  ctx.fillStyle = '#efe2d1';
  roundRect(ctx, x, 22, width, 18, 9);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x, 22, Math.max(6, width * Math.max(0, Math.min(1, ratio))), 18, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(70,50,36,0.85)';
  ctx.font = font(11, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, 32);
  ctx.restore();
}

function smallButton(ctx, regions, id, x, y, w, h, label, dim = false) {
  ctx.save();
  ctx.fillStyle = dim ? '#e6d8c8' : C.white;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = C.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.font = font(14);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
  regions.add(id, x, y, w, h);
}

export function drawToolbar(ctx, state, regions, ui) {
  const y = H - LAYOUT.TOOL_BAR_H;
  ctx.save();
  ctx.fillStyle = 'rgba(255,252,246,0.97)';
  ctx.fillRect(0, y, W, LAYOUT.TOOL_BAR_H);
  ctx.fillStyle = C.panelEdge;
  ctx.fillRect(0, y, W, 3);

  const tools = Object.values(ACTIONS);
  const bw = 150;
  const gap = 12;
  const totalW = tools.length * bw + (tools.length - 1) * gap;
  let x = (W - totalW) / 2;
  for (const tool of tools) {
    const active = state.tool === tool.id;
    const hovered = ui.hoverId === `tool:${tool.id}`;
    ctx.fillStyle = active ? C.pink : hovered ? '#fff2f5' : C.white;
    roundRect(ctx, x, y + 14, bw, 62, 14);
    ctx.fill();
    ctx.strokeStyle = active ? C.pinkDeep : C.panelEdge;
    ctx.lineWidth = active ? 3 : 2;
    ctx.stroke();

    drawNeedIcon(ctx, tool.icon, x + 32, y + 45, 17);

    ctx.fillStyle = active ? C.white : C.ink;
    ctx.font = font(17);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tool.label, x + 56, y + 38);
    ctx.font = font(11, 700);
    ctx.fillStyle = active ? 'rgba(255,255,255,0.9)' : C.inkSoft;
    ctx.fillText(tool.cost ? `${tool.cost}円` : 'むりょう', x + 56, y + 58);

    ctx.textAlign = 'right';
    ctx.fillText(`[${tool.key}]`, x + bw - 10, y + 58);

    regions.add(`tool:${tool.id}`, x, y + 14, bw, 62, tool.id);
    x += bw + gap;
  }
  ctx.restore();
}

export function drawPetCard(ctx, state, regions, time) {
  const pet = state.pets.find((p) => p.id === state.selectedPetId);
  if (!pet) return;
  const x = 14;
  const y = LAYOUT.TOP_BAR_H + 12;
  const w = 226;
  const h = 216;

  ctx.save();
  ctx.fillStyle = C.panel;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = C.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();

  const breed = breedOf(pet);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = font(19);
  ctx.fillText(pet.name, x + 16, y + 24);
  ctx.font = font(11, 700);
  ctx.fillStyle = C.inkSoft;
  ctx.fillText(`${breed.name} ・ ${pet.species === 'dog' ? 'いぬ' : 'ねこ'} ・ ${pet.ageMonths}ヶ月`, x + 16, y + 44);
  ctx.fillStyle = C.pinkDeep;
  ctx.fillText(`せいかく: ${personalityById(pet.personality).name}`, x + 16, y + 60);

  const bars = [
    { label: 'おなか', v: pet.needs.hunger, color: '#f6a96b' },
    { label: 'きれい', v: pet.needs.clean, color: '#8ec9ea' },
    { label: 'げんき', v: pet.needs.energy, color: '#9bd77f' },
    { label: 'なつき', v: pet.needs.affection, color: C.pink },
    { label: 'けんこう', v: pet.needs.health, color: '#e88a8a' },
  ];
  let by = y + 78;
  ctx.font = font(11, 700);
  for (const bar of bars) {
    ctx.fillStyle = C.inkSoft;
    ctx.textAlign = 'left';
    ctx.fillText(bar.label, x + 16, by + 6);
    ctx.fillStyle = '#eee0cf';
    roundRect(ctx, x + 66, by, 118, 11, 6);
    ctx.fill();
    ctx.fillStyle = bar.color;
    roundRect(ctx, x + 66, by, Math.max(4, 118 * (bar.v / 100)), 11, 6);
    ctx.fill();
    ctx.fillStyle = C.inkSoft;
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(bar.v)), x + w - 12, by + 6);
    by += 18;
  }

  const mood = moodOf(pet);
  ctx.textAlign = 'left';
  ctx.font = font(13);
  ctx.fillStyle = C.ink;
  ctx.fillText(`きぶん: ${mood.label}`, x + 16, by + 12);

  const ready = isAdoptable(pet);
  ctx.fillStyle = ready ? C.mint : '#e0d3c2';
  roundRect(ctx, x + 16, by + 26, w - 32, 26, 10);
  ctx.fill();
  ctx.fillStyle = ready ? '#fff' : C.inkSoft;
  ctx.font = font(12, 800);
  ctx.textAlign = 'center';
  ctx.fillText(ready ? 'おむかえOK！' : 'まだ お世話がひつよう', x + w / 2, by + 39);
  if (ready) drawHeart(ctx, x + w - 30, y + 22 + Math.sin(time * 4) * 2, 9, C.pinkDeep);

  ctx.restore();
  regions.add('petcard', x, y, w, h);
}

export function drawLogTicker(ctx, state) {
  const entries = state.log.slice(0, 3);
  if (!entries.length) return;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let y = H - LAYOUT.TOOL_BAR_H - 22;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const alpha = 1 - i * 0.3;
    ctx.globalAlpha = alpha;
    ctx.font = font(13, 700);
    const w = ctx.measureText(e.text).width + 22;
    ctx.fillStyle = 'rgba(255,253,248,0.9)';
    roundRect(ctx, 14, y - 12, w, 24, 12);
    ctx.fill();
    ctx.fillStyle = e.kind === 'good' ? '#3f9d78' : e.kind === 'bad' ? C.red : C.ink;
    ctx.fillText(e.text, 26, y + 1);
    y -= 28;
  }
  ctx.restore();
}

export function drawHint(ctx, state) {
  const tool = ACTIONS[state.tool];
  if (!tool) return;
  const text = tool.hint;
  ctx.save();
  ctx.font = font(13, 700);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 24;
  const x = W - 16 - w;
  const y = H - LAYOUT.TOOL_BAR_H - 22;
  ctx.fillStyle = 'rgba(255,253,248,0.9)';
  roundRect(ctx, x, y - 13, w, 26, 13);
  ctx.fill();
  ctx.fillStyle = C.inkSoft;
  ctx.fillText(text, W - 28, y + 1);
  ctx.restore();
}

export { condition };
