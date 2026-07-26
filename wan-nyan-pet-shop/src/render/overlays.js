import { C, font, roundRect } from './palette.js';
import { LAYOUT, UPGRADES, RESTOCK_COST, DAY } from '../game/balance.js';
import { upgradeCost, capacity } from '../game/state.js';
import { formatMoney } from './hud.js';
import { drawHeart } from './sprites.js';

const W = LAYOUT.WIDTH;
const H = LAYOUT.HEIGHT;

export function dim(ctx, alpha = 0.45) {
  ctx.fillStyle = `rgba(60,42,30,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

export function panel(ctx, x, y, w, h, title) {
  ctx.save();
  ctx.fillStyle = C.white;
  roundRect(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.strokeStyle = C.pink;
  ctx.lineWidth = 4;
  ctx.stroke();
  if (title) {
    ctx.fillStyle = C.pink;
    roundRect(ctx, x + 24, y - 20, w - 48, 44, 22);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.font = font(21);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + w / 2, y + 3);
  }
  ctx.restore();
}

export function button(ctx, regions, id, x, y, w, h, label, opts = {}) {
  const { disabled = false, tone = 'primary', sub = null, hovered = false } = opts;
  const bg = disabled ? '#e2d6c8' : tone === 'primary' ? (hovered ? '#ffa8bd' : C.pink) : hovered ? '#fff4f6' : C.white;
  const fg = disabled ? '#a9998a' : tone === 'primary' ? C.white : C.ink;
  ctx.save();
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = disabled ? '#d4c5b4' : tone === 'primary' ? C.pinkDeep : C.panelEdge;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = font(sub ? 17 : 18);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + (sub ? h / 2 - 9 : h / 2));
  if (sub) {
    ctx.font = font(12, 700);
    ctx.globalAlpha = 0.9;
    ctx.fillText(sub, x + w / 2, y + h / 2 + 12);
  }
  ctx.restore();
  if (!disabled) regions.add(id, x, y, w, h);
  return { x, y, w, h };
}

export function drawTitle(ctx, regions, ui, time, hasSaveData) {
  dim(ctx, 0.38);
  const w = 560;
  const h = 330;
  const x = (W - w) / 2;
  const y = 110;
  panel(ctx, x, y, w, h);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.pinkDeep;
  ctx.font = font(38);
  ctx.fillText('わんニャン', x + w / 2, y + 62 + Math.sin(time * 2) * 2);
  ctx.fillText('ペットショップ', x + w / 2, y + 106 + Math.sin(time * 2 + 0.4) * 2);
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(15, 700);
  ctx.fillText('かわいいペットとふれあう毎日', x + w / 2, y + 142);
  drawHeart(ctx, x + 74, y + 84, 16, C.pink);
  drawHeart(ctx, x + w - 74, y + 84, 16, C.mint);
  ctx.restore();

  button(ctx, regions, 'btn:start', x + w / 2 - 210, y + 176, 200, 56, 'はじめから', {
    hovered: ui.hoverId === 'btn:start',
  });
  button(ctx, regions, 'btn:continue', x + w / 2 + 10, y + 176, 200, 56, 'つづきから', {
    tone: 'ghost',
    disabled: !hasSaveData,
    hovered: ui.hoverId === 'btn:continue',
  });

  ctx.save();
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(12, 700);
  ctx.textAlign = 'center';
  ctx.fillText('道具をえらんで ペットをクリック ／ キー 1〜5 で道具きりかえ ／ Esc でポーズ', x + w / 2, y + 264);
  ctx.fillText('お世話して なつかせて、すてきな里親さんに おとどけしよう', x + w / 2, y + 288);
  ctx.restore();
}

export function drawReport(ctx, state, regions, ui) {
  const r = state.lastReport;
  if (!r) return;
  dim(ctx);
  const w = 520;
  const h = 404;
  const x = (W - w) / 2;
  const y = 92;
  panel(ctx, x, y, w, h, `${r.day}日目の せいさん`);

  const rows = [
    ['おむかえ', `${r.adoptions}件`, r.adoptions > 0 ? C.mint : C.inkSoft],
    ['売上', `+${formatMoney(r.income)}`, '#3f9d78'],
    ['ごはん代', r.food ? `-${formatMoney(r.food)}` : '-', C.inkSoft],
    ['病院代', r.vet ? `-${formatMoney(r.vet)}` : '-', r.vet ? C.red : C.inkSoft],
    ['家賃', `-${formatMoney(r.rent)}`, C.inkSoft],
    ['お世話した回数', `${r.careActions}回`, C.inkSoft],
    ['ペットの平均コンディション', `${r.avgCondition}`, r.avgCondition > 65 ? '#3f9d78' : C.gold],
    ['評判', `${r.reputation} (${r.careBonus >= 0 ? '+' : ''}${r.careBonus})`, C.pinkDeep],
  ];

  ctx.save();
  ctx.textBaseline = 'middle';
  let ry = y + 60;
  for (const [label, value, color] of rows) {
    ctx.font = font(14, 700);
    ctx.fillStyle = C.inkSoft;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 34, ry);
    ctx.font = font(15);
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(value, x + w - 34, ry);
    ctx.strokeStyle = 'rgba(232,211,186,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 30, ry + 14);
    ctx.lineTo(x + w - 30, ry + 14);
    ctx.stroke();
    ry += 30;
  }

  ctx.font = font(20);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.fillText('本日の もうけ', x + 34, ry + 14);
  ctx.textAlign = 'right';
  ctx.fillStyle = r.profit >= 0 ? '#3f9d78' : C.red;
  ctx.fillText(`${r.profit >= 0 ? '+' : ''}${formatMoney(r.profit)}`, x + w - 34, ry + 14);
  ctx.restore();

  button(ctx, regions, 'btn:toshop', x + w / 2 - 110, y + h - 64, 220, 50, 'お店じゅんびへ', {
    hovered: ui.hoverId === 'btn:toshop',
  });
}

export function drawShopScreen(ctx, state, regions, ui) {
  dim(ctx);
  const w = 760;
  const h = 400;
  const x = (W - w) / 2;
  const y = 92;
  panel(ctx, x, y, w, h, `お店のじゅんび（${state.day + 1}日目のまえに）`);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(15);
  ctx.fillStyle = C.ink;
  ctx.fillText(`しょじきん: ${formatMoney(state.money)}`, x + 30, y + 48);
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(12, 700);
  ctx.fillText(`あずかり中: ${state.pets.length} / ${capacity(state)} 匹`, x + 240, y + 48);
  ctx.restore();

  const cardW = 348;
  const cardH = 92;
  UPGRADES.forEach((u, i) => {
    const cx = x + 30 + (i % 2) * (cardW + 24);
    const cy = y + 70 + Math.floor(i / 2) * (cardH + 14);
    const level = state.upgrades[u.id] || 0;
    const cost = upgradeCost(state, u.id);
    const maxed = cost == null;
    const affordable = !maxed && state.money >= cost;

    ctx.save();
    ctx.fillStyle = '#fff8f0';
    roundRect(ctx, cx, cy, cardW, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.font = font(16);
    ctx.fillText(u.name, cx + 16, cy + 24);
    ctx.fillStyle = C.inkSoft;
    ctx.font = font(11, 700);
    ctx.fillText(u.desc, cx + 16, cy + 46);
    // level pips
    for (let k = 0; k < u.max; k++) {
      ctx.fillStyle = k < level ? C.mint : '#e6d8c8';
      ctx.beginPath();
      ctx.arc(cx + 22 + k * 16, cy + 70, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    button(
      ctx, regions, `btn:buy:${u.id}`, cx + cardW - 122, cy + 22, 106, 50,
      maxed ? 'さいだい' : 'かう',
      {
        disabled: maxed || !affordable,
        sub: maxed ? null : formatMoney(cost),
        hovered: ui.hoverId === `btn:buy:${u.id}`,
      },
    );
  });

  const full = state.pets.length >= capacity(state);
  button(ctx, regions, 'btn:restock', x + 30, y + h - 66, 240, 52, '新しい子をおむかえ', {
    tone: 'ghost',
    disabled: full || state.money < RESTOCK_COST,
    sub: full ? 'ベッドがいっぱい' : formatMoney(RESTOCK_COST),
    hovered: ui.hoverId === 'btn:restock',
  });
  button(ctx, regions, 'btn:open', x + w - 270, y + h - 66, 240, 52, `${state.day + 1}日目を はじめる`, {
    hovered: ui.hoverId === 'btn:open',
  });
}

export function drawEnding(ctx, state, regions, ui, time) {
  dim(ctx, 0.5);
  const w = 560;
  const h = 320;
  const x = (W - w) / 2;
  const y = 130;
  panel(ctx, x, y, w, h, '町いちばんの人気店！');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.pinkDeep;
  ctx.font = font(26);
  ctx.fillText(`評判 ${DAY.GOAL_REPUTATION} 達成！`, x + w / 2, y + 74);
  ctx.fillStyle = C.ink;
  ctx.font = font(15, 700);
  ctx.fillText(`${state.day}日で ${state.stats.adoptions}匹の子が しあわせなおうちへ`, x + w / 2, y + 116);
  ctx.fillText(`売上ごうけい ${formatMoney(state.stats.earned)} ／ お世話 ${state.stats.careActions}回`, x + w / 2, y + 146);
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(13, 700);
  ctx.fillText('これからも みんなと ふれあう毎日は つづきます', x + w / 2, y + 182);
  for (let i = 0; i < 5; i++) {
    drawHeart(ctx, x + 70 + i * 110, y + 220 + Math.sin(time * 3 + i) * 5, 12, i % 2 ? C.pink : C.mint);
  }
  ctx.restore();
  button(ctx, regions, 'btn:keepgoing', x + w / 2 - 120, y + h - 62, 240, 50, 'お店をつづける', {
    hovered: ui.hoverId === 'btn:keepgoing',
  });
}

export function drawGameOver(ctx, state, regions, ui) {
  dim(ctx, 0.55);
  const w = 500;
  const h = 280;
  const x = (W - w) / 2;
  const y = 150;
  panel(ctx, x, y, w, h, 'へいてん…');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.ink;
  ctx.font = font(16, 700);
  ctx.fillText('資金がそこをついてしまいました', x + w / 2, y + 66);
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(14, 700);
  ctx.fillText(`${state.day}日間 / おむかえ ${state.stats.adoptions}匹 / 売上 ${formatMoney(state.stats.earned)}`, x + w / 2, y + 104);
  ctx.fillText('ごはん代と家賃に気をつけて、もういちど！', x + w / 2, y + 134);
  ctx.restore();
  button(ctx, regions, 'btn:retry', x + w / 2 - 110, y + h - 74, 220, 52, 'もういちど あそぶ', {
    hovered: ui.hoverId === 'btn:retry',
  });
}

export function drawPause(ctx, regions, ui) {
  dim(ctx, 0.4);
  const w = 380;
  const h = 220;
  const x = (W - w) / 2;
  const y = 180;
  panel(ctx, x, y, w, h, 'ひとやすみ');
  button(ctx, regions, 'btn:resume', x + w / 2 - 130, y + 60, 260, 48, 'もどる', {
    hovered: ui.hoverId === 'btn:resume',
  });
  button(ctx, regions, 'btn:save', x + w / 2 - 130, y + 118, 260, 48, 'セーブしてタイトルへ', {
    tone: 'ghost',
    hovered: ui.hoverId === 'btn:save',
  });
}
