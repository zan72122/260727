/** Shared pastel palette. Kept in one place so the whole game reads as one shop. */
export const C = {
  wallTop: '#fdf3e3',
  wallBottom: '#f6e3cd',
  wallStripe: '#f9ead7',
  moulding: '#e7c9a6',
  floorA: '#dcae7d',
  floorB: '#d3a173',
  floorLine: '#c08e60',
  rug: '#ffd9e0',
  rugInner: '#ffeef2',
  wood: '#b47b4c',
  woodDark: '#95633a',
  counter: '#c98d5b',
  ink: '#5a4232',
  inkSoft: '#8a705c',
  white: '#fffdf9',
  panel: 'rgba(255,253,248,0.94)',
  panelEdge: '#e8d3ba',
  pink: '#ff90a8',
  pinkDeep: '#f2637f',
  mint: '#78d3b4',
  sky: '#bfe6ff',
  sun: '#ffe9a8',
  gold: '#f5b942',
  red: '#e8695f',
  shadow: 'rgba(90,66,50,0.18)',
  bubble: 'rgba(255,255,255,0.95)',
};

export const FONT = {
  // Japanese-capable stack; the last two entries are what Linux/CI boxes
  // actually have installed, so headless screenshots render real glyphs.
  ui: '"Hiragino Maru Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", "IPAPGothic", "IPAGothic", system-ui, sans-serif',
};

export function font(size, weight = 700) {
  return `${weight} ${size}px ${FONT.ui}`;
}

/** Rounded rectangle path helper (Path2D-free so it works on any 2D context). */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(Math.min(255, Math.max(0, ((n >> 16) & 255) + amount)));
  const g = Math.round(Math.min(255, Math.max(0, ((n >> 8) & 255) + amount)));
  const b = Math.round(Math.min(255, Math.max(0, (n & 255) + amount)));
  return `rgb(${r},${g},${b})`;
}
