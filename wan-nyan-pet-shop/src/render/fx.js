import { C, font } from './palette.js';
import { drawHeart } from './sprites.js';

const MAX_PARTICLES = 180;

/**
 * Fixed-capacity particle pool. Particles are recycled in place so a long play
 * session allocates nothing per frame.
 */
export class Particles {
  constructor(max = MAX_PARTICLES) {
    this.items = new Array(max);
    for (let i = 0; i < max; i++) {
      this.items[i] = { alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, kind: 'heart', size: 1, text: '', color: C.pink, rot: 0, spin: 0 };
    }
    this.cursor = 0;
  }

  spawn(kind, x, y, opts = {}) {
    let p = null;
    for (let i = 0; i < this.items.length; i++) {
      const cand = this.items[(this.cursor + i) % this.items.length];
      if (!cand.alive) {
        p = cand;
        this.cursor = (this.cursor + i + 1) % this.items.length;
        break;
      }
    }
    if (!p) return null; // pool exhausted: drop the effect rather than allocate
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? -30;
    p.life = opts.life ?? 1;
    p.maxLife = p.life;
    p.size = opts.size ?? 1;
    p.text = opts.text ?? '';
    p.color = opts.color ?? C.pink;
    p.rot = opts.rot ?? 0;
    p.spin = opts.spin ?? 0;
    p.gravity = opts.gravity ?? 8;
    return p;
  }

  burstHearts(x, y, n = 4, rng = Math.random) {
    for (let i = 0; i < n; i++) {
      this.spawn('heart', x + (rng() - 0.5) * 26, y - 20 - rng() * 14, {
        vx: (rng() - 0.5) * 26,
        vy: -34 - rng() * 26,
        life: 1.1 + rng() * 0.5,
        size: 0.75 + rng() * 0.55,
        color: rng() > 0.5 ? C.pink : C.pinkDeep,
      });
    }
  }

  burstSparkles(x, y, n = 6, color = '#ffe9a8', rng = Math.random) {
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const sp = 30 + rng() * 60;
      this.spawn('sparkle', x, y, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 14,
        life: 0.5 + rng() * 0.4,
        size: 0.6 + rng() * 0.7,
        color,
        gravity: 30,
        spin: (rng() - 0.5) * 8,
      });
    }
  }

  burstCrumbs(x, y, n = 6, rng = Math.random) {
    for (let i = 0; i < n; i++) {
      this.spawn('crumb', x, y, {
        vx: (rng() - 0.5) * 60,
        vy: -20 - rng() * 40,
        life: 0.7 + rng() * 0.3,
        size: 0.7 + rng() * 0.6,
        color: '#d8a45f',
        gravity: 140,
      });
    }
  }

  floatText(x, y, text, color = C.gold) {
    this.spawn('text', x, y, { vy: -34, life: 1.4, text, color, gravity: 0 });
  }

  update(dt) {
    for (const p of this.items) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.rot += p.spin * dt;
    }
  }

  draw(ctx) {
    for (const p of this.items) {
      if (!p.alive) continue;
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.6);
      switch (p.kind) {
        case 'heart':
          drawHeart(ctx, p.x, p.y, 9 * p.size, p.color);
          break;
        case 'sparkle': {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          const r = 7 * p.size;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            ctx.lineTo(Math.cos(a + Math.PI / 4) * r * 0.32, Math.sin(a + Math.PI / 4) * r * 0.32);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'crumb':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, 3.2 * p.size, 2.6 * p.size, p.rot, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'text':
          ctx.font = font(17, 800);
          ctx.textAlign = 'center';
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
          break;
        default:
          break;
      }
      ctx.restore();
    }
  }

  get activeCount() {
    let n = 0;
    for (const p of this.items) if (p.alive) n++;
    return n;
  }

  clear() {
    for (const p of this.items) p.alive = false;
  }
}
