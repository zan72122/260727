import { C, font, roundRect } from './palette.js';
import { LAYOUT } from '../game/balance.js';

const W = LAYOUT.WIDTH;
const H = LAYOUT.HEIGHT;
const FLOOR_Y = LAYOUT.FLOOR.y - 26;

/**
 * The shop interior never changes, so it is painted once into an offscreen
 * canvas and blitted each frame. This is the single biggest render saving in
 * the game (see docs/PERFORMANCE.md).
 */
export function buildRoomLayer(createCanvas) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  drawRoom(ctx);
  return canvas;
}

/**
 * Layout note: the selected-pet card occupies the top-left corner of the play
 * area, so nothing decorative is placed left of x≈260 below the top bar.
 */
export function drawRoom(ctx) {
  drawWall(ctx);
  drawClock(ctx, 236, 118);
  drawWindow(ctx, 300, 128);
  drawShelf(ctx, 622, 150);
  drawBanner(ctx, W / 2, 88);
  drawFloor(ctx);
  drawRug(ctx);
  drawDoor(ctx, W - 92, FLOOR_Y - 118);
  drawPlant(ctx, 548, FLOOR_Y + 26);
}

function drawWall(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  g.addColorStop(0, C.wallTop);
  g.addColorStop(1, C.wallBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, FLOOR_Y);

  ctx.fillStyle = C.wallStripe;
  for (let x = 0; x < W; x += 56) ctx.fillRect(x, 0, 28, FLOOR_Y);

  // paw print wallpaper motif
  ctx.fillStyle = 'rgba(230,196,160,0.5)';
  for (let y = 40; y < FLOOR_Y - 20; y += 74) {
    for (let x = 34 + ((y / 74) % 2) * 37; x < W; x += 74) paw(ctx, x, y, 5);
  }

  ctx.fillStyle = C.moulding;
  ctx.fillRect(0, FLOOR_Y - 14, W, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, FLOOR_Y - 14, W, 4);
}

function paw(ctx, x, y, r) {
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.6, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(x + i * r * 0.85, y - r * 0.55, r * 0.34, r * 0.42, i * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClock(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#f6e0c4';
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.wood;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = C.white;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 12);
  ctx.moveTo(x, y);
  ctx.lineTo(x + 9, y + 5);
  ctx.stroke();
  // little ears on top, because everything in this shop is a bit pet-shaped
  ctx.fillStyle = C.wood;
  ctx.beginPath();
  ctx.ellipse(x - 17, y - 21, 7, 9, -0.6, 0, Math.PI * 2);
  ctx.ellipse(x + 17, y - 21, 7, 9, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWindow(ctx, x, y) {
  const w = 196;
  const h = 104;
  ctx.save();
  ctx.fillStyle = C.sky;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#a9dcff');
  g.addColorStop(1, '#e6f6ff');
  ctx.fillStyle = g;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = C.sun;
  ctx.beginPath();
  ctx.arc(x + w - 46, y + 38, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  cloud(ctx, x + 52, y + 46, 20);
  cloud(ctx, x + 140, y + 76, 15);
  ctx.fillStyle = '#a9d8a0';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 6, w * 0.7, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = C.white;
  ctx.lineWidth = 9;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();

  // curtain
  ctx.fillStyle = 'rgba(255,170,190,0.75)';
  ctx.beginPath();
  ctx.moveTo(x - 14, y - 10);
  ctx.quadraticCurveTo(x + 34, y + h * 0.45, x - 6, y + h + 6);
  ctx.lineTo(x - 26, y + h + 6);
  ctx.lineTo(x - 26, y - 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function cloud(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r, y + 4, r * 0.75, 0, Math.PI * 2);
  ctx.arc(x - r, y + 5, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawBanner(ctx, cx, y) {
  const w = 268;
  const h = 54;
  ctx.save();
  ctx.translate(cx, y);
  ctx.strokeStyle = C.woodDark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 18, -h / 2);
  ctx.lineTo(-w / 2 + 18, -h / 2 - 26);
  ctx.moveTo(w / 2 - 18, -h / 2);
  ctx.lineTo(w / 2 - 18, -h / 2 - 26);
  ctx.stroke();

  ctx.fillStyle = C.white;
  roundRect(ctx, -w / 2, -h / 2, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = C.pink;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = C.pinkDeep;
  ctx.font = font(21);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('わんニャンペットショップ', 0, -4);
  ctx.fillStyle = C.inkSoft;
  ctx.font = font(11, 600);
  ctx.fillText('かわいいペットとふれあう毎日', 0, 16);
  ctx.restore();
}

function drawShelf(ctx, x, y) {
  const w = 188;
  ctx.fillStyle = C.wood;
  for (let i = 0; i < 2; i++) {
    const sy = y + i * 62;
    roundRect(ctx, x, sy, w, 10, 4);
    ctx.fill();
    // jars and toys
    const items = i === 0
      ? [['#ffd0dc', 'ball'], ['#cfe9ff', 'jar'], ['#ffe6ab', 'bone']]
      : [['#ffe0b2', 'jar'], ['#e5d6ff', 'ball'], ['#cdeee4', 'jar']];
    items.forEach(([color, kind], k) => {
      const ix = x + 34 + k * 60;
      const iy = sy;
      ctx.fillStyle = color;
      if (kind === 'jar') {
        roundRect(ctx, ix - 15, iy - 34, 30, 34, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        roundRect(ctx, ix - 15, iy - 38, 30, 8, 4);
        ctx.fill();
      } else if (kind === 'ball') {
        ctx.beginPath();
        ctx.arc(ix, iy - 15, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ix, iy - 15, 15, 0.6, 2.2);
        ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(ix, iy - 14);
        ctx.rotate(-0.3);
        roundRect(ctx, -16, -5, 32, 10, 5);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-16, -5, 6, 0, Math.PI * 2);
        ctx.arc(-16, 5, 6, 0, Math.PI * 2);
        ctx.arc(16, -5, 6, 0, Math.PI * 2);
        ctx.arc(16, 5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  }
}

function drawPlant(ctx, x, y) {
  ctx.fillStyle = '#d98d63';
  ctx.beginPath();
  ctx.moveTo(x - 20, y - 28);
  ctx.lineTo(x + 20, y - 28);
  ctx.lineTo(x + 14, y);
  ctx.lineTo(x - 14, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7cbf74';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.4;
    ctx.save();
    ctx.translate(x, y - 28);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, -25, 10, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFloor(ctx) {
  const top = FLOOR_Y;
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, C.floorA);
  g.addColorStop(1, C.floorB);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, H - top);

  ctx.strokeStyle = C.floorLine;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.45;
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * W;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + (x - W / 2) * 0.28, H);
    ctx.stroke();
  }
  for (let y = top + 34; y < H; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawRug(ctx) {
  const cx = W / 2;
  const cy = LAYOUT.FLOOR.y + LAYOUT.FLOOR.h * 0.62;
  ctx.save();
  ctx.fillStyle = C.rug;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 246, 84, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.rugInner;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 196, 64, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,190,205,0.55)';
  paw(ctx, cx, cy - 6, 15);
  ctx.restore();
}

function drawDoor(ctx, x, y) {
  ctx.fillStyle = C.woodDark;
  roundRect(ctx, x - 46, y, 92, 150, 10);
  ctx.fill();
  ctx.fillStyle = '#f6e0c4';
  roundRect(ctx, x - 38, y + 8, 76, 134, 8);
  ctx.fill();
  ctx.fillStyle = '#cfeaff';
  roundRect(ctx, x - 28, y + 20, 56, 52, 8);
  ctx.fill();
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(x + 24, y + 92, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.pinkDeep;
  ctx.font = font(13);
  ctx.textAlign = 'center';
  ctx.fillText('OPEN', x, y + 116);
}

export { FLOOR_Y };
