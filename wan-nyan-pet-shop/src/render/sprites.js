import { C, font, roundRect, shade } from './palette.js';
import { DOG_BREEDS, CAT_BREEDS, CUSTOMER_LOOKS } from '../game/data.js';
import { urgentNeed, moodOf } from '../game/pets.js';

export function breedOf(pet) {
  const list = pet.species === 'dog' ? DOG_BREEDS : CAT_BREEDS;
  return list[pet.breedIndex % list.length];
}

function shadow(ctx, w, h) {
  ctx.fillStyle = C.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws one pet at its world position. Everything is vector art derived from the
 * breed table — there are no image assets anywhere in the project.
 */
export function drawPet(ctx, pet, time, { selected = false, hovered = false } = {}) {
  const breed = breedOf(pet);
  const s = 30 * pet.scale * breed.size;
  const sleeping = pet.state === 'sleep';
  const walking = pet.state === 'walk';
  const playing = pet.state === 'play';
  const eating = pet.state === 'eat';

  const bounce = playing
    ? Math.abs(Math.sin(pet.animPhase * 1.4)) * s * 0.34
    : walking
      ? Math.abs(Math.sin(pet.animPhase * 1.6)) * s * 0.08
      : 0;
  const breathe = Math.sin(time * 2.2 + pet.animPhase * 0.2) * s * 0.02;
  const squash = sleeping ? 0.82 : 1;

  ctx.save();
  ctx.translate(pet.pos.x, pet.pos.y);

  shadow(ctx, s * 0.85, s * 0.26);

  if (selected || hovered) {
    ctx.strokeStyle = selected ? C.pinkDeep : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = selected ? 3 : 2;
    ctx.setLineDash(selected ? [7, 6] : []);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.02, s * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.translate(0, -bounce);
  ctx.scale(pet.facing, 1);

  const coat = breed.coat;
  const accent = breed.accent;
  const bodyY = -s * (0.58 * squash) + breathe;

  drawTail(ctx, pet, breed, s, bodyY, time, sleeping);

  // hind + front legs
  ctx.fillStyle = shade(coat, -14);
  const legSwing = walking ? Math.sin(pet.animPhase * 1.6) * s * 0.14 : 0;
  legEllipse(ctx, -s * 0.34 - legSwing, -s * 0.12, s * 0.19, s * 0.16);
  legEllipse(ctx, s * 0.3 + legSwing, -s * 0.12, s * 0.19, s * 0.16);

  // body
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(0, bodyY, s * 0.74, s * (0.56 * squash), 0, 0, Math.PI * 2);
  ctx.fill();
  if (breed.fluff > 0.5) {
    ctx.fillStyle = shade(coat, 12);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.15 + i * 0.18);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * s * 0.62, bodyY + Math.sin(a) * s * 0.42, s * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // belly patch
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(s * 0.1, bodyY + s * 0.2, s * 0.42, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = shade(coat, -6);
  legEllipse(ctx, -s * 0.12 + legSwing, -s * 0.1, s * 0.2, s * 0.17);
  legEllipse(ctx, s * 0.48 - legSwing, -s * 0.1, s * 0.2, s * 0.17);

  // head
  const headX = s * 0.44;
  const headY = bodyY - s * (sleeping ? 0.32 : 0.58) + (eating ? s * 0.12 : 0);
  drawHead(ctx, pet, breed, s, headX, headY, time, sleeping);

  ctx.restore();

  drawDirt(ctx, pet, s);
}

function legEllipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTail(ctx, pet, breed, s, bodyY, time, sleeping) {
  const wag = sleeping ? 0.06 : (pet.needs.affection / 100) * 0.55 + 0.2;
  const a = Math.sin(time * (pet.state === 'play' ? 12 : 5) + pet.animPhase) * wag;
  ctx.save();
  ctx.translate(-s * 0.66, bodyY - s * 0.1);
  ctx.rotate(-0.5 + a);
  ctx.fillStyle = shade(breed.coat, -8);
  if (breed.tail === 'curl') {
    ctx.beginPath();
    ctx.arc(0, -s * 0.22, s * 0.3, 0.4, Math.PI * 1.75);
    ctx.lineWidth = s * 0.2;
    ctx.strokeStyle = shade(breed.coat, -8);
    ctx.lineCap = 'round';
    ctx.stroke();
  } else if (breed.tail === 'puff') {
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, -s * 0.16, s * 0.26, s * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (breed.tail === 'long') {
    ctx.lineWidth = s * 0.15;
    ctx.strokeStyle = shade(breed.coat, -8);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.42, -s * 0.34, -s * 0.16, -s * 0.86);
    ctx.stroke();
  } else {
    ctx.lineWidth = s * 0.16;
    ctx.strokeStyle = shade(breed.coat, -8);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.34, -s * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHead(ctx, pet, breed, s, x, y, time, sleeping) {
  const tilt = sleeping ? 0.3 : Math.sin(time * 1.4 + pet.animPhase) * 0.05;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);

  // ears (behind head)
  ctx.fillStyle = shade(breed.coat, -18);
  if (breed.ear === 'perk') {
    ear(ctx, -s * 0.3, -s * 0.36, s * 0.3, -0.35);
    ear(ctx, s * 0.26, -s * 0.38, s * 0.3, 0.3);
  } else if (breed.ear === 'fold') {
    ctx.beginPath();
    ctx.ellipse(-s * 0.32, -s * 0.2, s * 0.2, s * 0.14, -0.5, 0, Math.PI * 2);
    ctx.ellipse(s * 0.3, -s * 0.22, s * 0.2, s * 0.14, 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(-s * 0.38, -s * 0.02, s * 0.19, s * 0.34, -0.25, 0, Math.PI * 2);
    ctx.ellipse(s * 0.36, -s * 0.04, s * 0.19, s * 0.34, 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // head shape
  ctx.fillStyle = breed.coat;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.5, s * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  // muzzle
  ctx.fillStyle = breed.accent;
  ctx.beginPath();
  ctx.ellipse(s * 0.12, s * 0.16, s * 0.28, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  const eyeY = -s * 0.06;
  const blink = pet.blink > 0 || sleeping;
  ctx.strokeStyle = '#3a2c22';
  ctx.fillStyle = '#3a2c22';
  ctx.lineWidth = Math.max(1.5, s * 0.06);
  ctx.lineCap = 'round';
  for (const ex of [-s * 0.18, s * 0.22]) {
    if (blink) {
      ctx.beginPath();
      ctx.arc(ex, eyeY, s * 0.1, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, s * 0.085, s * 0.105, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + s * 0.03, eyeY - s * 0.04, s * 0.032, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2c22';
    }
  }

  // nose + mouth
  ctx.fillStyle = pet.species === 'dog' ? '#4a3226' : '#e58a9c';
  ctx.beginPath();
  ctx.ellipse(s * 0.2, s * 0.08, s * 0.075, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a3226';
  ctx.lineWidth = Math.max(1.2, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(s * 0.2, s * 0.14);
  ctx.lineTo(s * 0.2, s * 0.2);
  ctx.moveTo(s * 0.2, s * 0.2);
  ctx.quadraticCurveTo(s * 0.1, s * 0.28, s * 0.04, s * 0.18);
  ctx.moveTo(s * 0.2, s * 0.2);
  ctx.quadraticCurveTo(s * 0.3, s * 0.28, s * 0.36, s * 0.18);
  ctx.stroke();

  if (pet.species === 'cat') {
    ctx.strokeStyle = 'rgba(90,70,55,0.55)';
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(s * 0.3, s * 0.1 + i * s * 0.06);
      ctx.lineTo(s * 0.62, s * 0.02 + i * s * 0.11);
      ctx.stroke();
    }
  } else if (pet.state === 'play' || pet.needs.affection > 65) {
    ctx.fillStyle = '#f4808f';
    ctx.beginPath();
    ctx.ellipse(s * 0.2, s * 0.28, s * 0.09, s * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // cheeks
  if (pet.needs.affection > 45) {
    ctx.fillStyle = 'rgba(255,150,170,0.45)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, s * 0.12, s * 0.11, s * 0.07, 0, 0, Math.PI * 2);
    ctx.ellipse(s * 0.42, s * 0.1, s * 0.11, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function ear(ctx, x, y, size, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, size * 0.5);
  ctx.quadraticCurveTo(0, -size * 0.9, size * 0.5, size * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDirt(ctx, pet, s) {
  if (pet.needs.clean >= 45) return;
  const amount = 1 - pet.needs.clean / 45;
  ctx.save();
  ctx.translate(pet.pos.x, pet.pos.y);
  ctx.fillStyle = `rgba(122,94,60,${0.25 + amount * 0.4})`;
  const spots = [
    [-s * 0.4, -s * 0.5], [s * 0.24, -s * 0.86], [-s * 0.08, -s * 0.28], [s * 0.5, -s * 0.4],
  ];
  const count = Math.max(1, Math.round(amount * spots.length));
  for (let i = 0; i < count; i++) {
    const [dx, dy] = spots[i];
    ctx.beginPath();
    ctx.ellipse(dx * pet.facing, dy, s * 0.12, s * 0.09, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Thought bubble with the pet's most urgent need, or its reaction line. */
export function drawPetBubble(ctx, pet, time) {
  const need = urgentNeed(pet);
  if (pet.reaction) {
    speechBubble(ctx, pet.pos.x, pet.pos.y - 74, pet.reaction);
    return;
  }
  if (!need) {
    if (pet.state === 'sleep') drawZzz(ctx, pet.pos.x + 22, pet.pos.y - 62, time);
    return;
  }
  const x = pet.pos.x;
  const y = pet.pos.y - 76 + Math.sin(time * 3 + pet.animPhase) * 3;
  ctx.save();
  ctx.fillStyle = C.bubble;
  ctx.strokeStyle = need.id === 'health' ? C.red : C.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - 6, y + 19, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawNeedIcon(ctx, need.icon, x, y, 12);
  ctx.restore();
}

export function drawNeedIcon(ctx, icon, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  switch (icon) {
    case 'bowl':
      ctx.fillStyle = '#e88a63';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.1);
      ctx.lineTo(r * 0.8, -r * 0.1);
      ctx.lineTo(r * 0.5, r * 0.55);
      ctx.lineTo(-r * 0.5, r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f6c98a';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.14, r * 0.78, r * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'brush':
      ctx.fillStyle = '#c58a5a';
      roundRect(ctx, -r * 0.7, -r * 0.6, r * 1.4, r * 0.7, 4);
      ctx.fill();
      ctx.strokeStyle = '#8a705c';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.28, r * 0.1);
        ctx.lineTo(i * r * 0.28, r * 0.62);
        ctx.stroke();
      }
      break;
    case 'ball':
      ctx.fillStyle = '#7fc4ea';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0.5, 2.2);
      ctx.stroke();
      break;
    case 'hand':
      ctx.fillStyle = '#f6c9a6';
      roundRect(ctx, -r * 0.5, -r * 0.2, r, r * 0.9, r * 0.35);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(-r * 0.3 + i * r * 0.3, -r * 0.35, r * 0.16, r * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'broom':
      ctx.strokeStyle = '#b07d4e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.7);
      ctx.lineTo(r * 0.2, r * 0.2);
      ctx.stroke();
      ctx.fillStyle = '#f0c46a';
      ctx.beginPath();
      ctx.moveTo(r * 0.05, r * 0.1);
      ctx.lineTo(r * 0.75, r * 0.4);
      ctx.lineTo(r * 0.3, r * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
    case 'heart':
      drawHeart(ctx, 0, 0, r * 0.85, C.pink);
      break;
    case 'cross':
      ctx.fillStyle = C.red;
      roundRect(ctx, -r * 0.7, -r * 0.24, r * 1.4, r * 0.48, 3);
      ctx.fill();
      roundRect(ctx, -r * 0.24, -r * 0.7, r * 0.48, r * 1.4, 3);
      ctx.fill();
      break;
    default:
      break;
  }
  ctx.restore();
}

export function drawHeart(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.75);
  ctx.bezierCurveTo(-r * 1.3, -r * 0.25, -r * 0.45, -r * 1.1, 0, -r * 0.35);
  ctx.bezierCurveTo(r * 0.45, -r * 1.1, r * 1.3, -r * 0.25, 0, r * 0.75);
  ctx.fill();
  ctx.restore();
}

function drawZzz(ctx, x, y, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(120,140,190,0.85)';
  for (let i = 0; i < 3; i++) {
    const p = (time * 0.6 + i * 0.33) % 1;
    ctx.globalAlpha = 0.9 * (1 - p);
    ctx.font = font(11 + i * 4);
    ctx.fillText('Z', x + p * 16 + i * 4, y - p * 26);
  }
  ctx.restore();
}

export function speechBubble(ctx, x, y, text, color = C.bubble) {
  ctx.save();
  ctx.font = font(13, 700);
  const w = Math.max(52, ctx.measureText(text).width + 22);
  const h = 28;
  ctx.fillStyle = color;
  ctx.strokeStyle = C.panelEdge;
  ctx.lineWidth = 2;
  roundRect(ctx, x - w / 2, y - h, w, h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + 5, y);
  ctx.lineTo(x - 1, y + 9);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - h / 2);
  ctx.restore();
}

export function drawCustomer(ctx, cus, time) {
  const look = CUSTOMER_LOOKS[cus.look % CUSTOMER_LOOKS.length];
  const s = 34;
  const walkPhase = cus.state === 'enter' || cus.state === 'leave' || cus.state === 'approach';
  const bob = walkPhase ? Math.abs(Math.sin(cus.animPhase)) * 3 : Math.sin(time * 2) * 1.2;
  ctx.save();
  ctx.translate(cus.pos.x, cus.pos.y);
  shadow(ctx, s * 0.6, s * 0.2);
  ctx.translate(0, -bob);
  ctx.scale(cus.facing, 1);

  // legs
  ctx.fillStyle = '#5a6478';
  const swing = walkPhase ? Math.sin(cus.animPhase) * 5 : 0;
  roundRect(ctx, -9 + swing * 0.4, -22, 8, 24, 4);
  ctx.fill();
  roundRect(ctx, 2 - swing * 0.4, -22, 8, 24, 4);
  ctx.fill();

  // coat
  ctx.fillStyle = look.coat;
  ctx.beginPath();
  ctx.moveTo(-15, -20);
  ctx.quadraticCurveTo(-17, -56, 0, -58);
  ctx.quadraticCurveTo(17, -56, 15, -20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(look.coat, -22);
  roundRect(ctx, -18, -52, 7, 26, 3);
  ctx.fill();
  roundRect(ctx, 11, -52, 7, 26, 3);
  ctx.fill();

  // head
  ctx.fillStyle = '#f7d9bd';
  ctx.beginPath();
  ctx.arc(0, -70, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.arc(0, -73, 15.5, Math.PI * 1.05, Math.PI * 2.05);
  ctx.fill();
  ctx.fillStyle = '#3a2c22';
  ctx.beginPath();
  ctx.arc(-5, -69, 1.9, 0, Math.PI * 2);
  ctx.arc(5, -69, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b4746a';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, -64, 3.4, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();

  if (cus.lineTime > 0 && cus.line) speechBubble(ctx, cus.pos.x, cus.pos.y - 92, cus.line);
  if (cus.state === 'approach' || cus.state === 'adopt') {
    drawHeart(ctx, cus.pos.x + 20, cus.pos.y - 96 + Math.sin(time * 5) * 3, 8, C.pinkDeep);
  }
}

export function drawMess(ctx, mess, hovered) {
  ctx.save();
  ctx.translate(mess.x, mess.y);
  ctx.rotate(mess.rot);
  if (mess.kind === 'fur') {
    ctx.fillStyle = 'rgba(150,120,90,0.75)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.cos(i * 1.7) * 7, Math.sin(i * 1.7) * 5, 6, 3.4, i, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mess.kind === 'puddle') {
    ctx.fillStyle = 'rgba(160,190,210,0.7)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-3, -2, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(130,100,70,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 5.5, -5, 2.4, 3, i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (hovered) {
    ctx.strokeStyle = C.mint;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBed(ctx, x, y, index) {
  const colors = ['#ffc3d0', '#c3e0ff', '#d6f0c9', '#ffe3ae', '#e0d3ff', '#c7f0e6'];
  const c = colors[index % colors.length];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = C.shadow;
  ctx.beginPath();
  ctx.ellipse(0, 8, 44, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // padded rim
  ctx.fillStyle = shade(c, -26);
  ctx.beginPath();
  ctx.ellipse(0, 0, 42, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, -5, 42, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  // inner cushion
  ctx.fillStyle = shade(c, 16);
  ctx.beginPath();
  ctx.ellipse(0, -2, 31, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // folded blanket
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.beginPath();
  ctx.ellipse(-13, -3, 15, 7, -0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(c, -34);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, -5, 42, 17, 0, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();
  ctx.restore();
}

export function petTooltipLabel(pet) {
  return `${pet.name} / ${moodOf(pet).label}`;
}
