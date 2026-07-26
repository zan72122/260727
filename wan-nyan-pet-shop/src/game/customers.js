import { CUSTOMER, LAYOUT, clamp, upgradeEffects } from './balance.js';
import { CUSTOMER_LOOKS, CUSTOMER_LINES, PERSONALITIES } from './data.js';
import { condition, isAdoptable } from './pets.js';

let nextCustomerId = 1;
export function _resetCustomerIds(v = 1) {
  nextCustomerId = v;
}

const DOOR = { x: LAYOUT.WIDTH - 46, y: LAYOUT.FLOOR.y + LAYOUT.FLOOR.h - 26 };

export function createCustomer(rng, day = 1) {
  const wantSpecies = rng.chance(0.62) ? (rng.chance(0.5) ? 'dog' : 'cat') : null;
  const wantPersonality = rng.chance(0.4) ? rng.pick(PERSONALITIES).id : null;
  return {
    id: nextCustomerId++,
    look: rng.int(0, CUSTOMER_LOOKS.length - 1),
    wantSpecies,
    wantPersonality,
    budget: 0.85 + rng.next() * 0.35 + Math.min(0.3, day * 0.02),
    patience: CUSTOMER.PATIENCE,
    browse: CUSTOMER.BROWSE_TIME,
    state: 'enter', // enter | browse | approach | adopt | leave | done
    pos: { x: DOOR.x, y: DOOR.y },
    target: {
      x: rng.range(LAYOUT.FLOOR.x + 140, LAYOUT.FLOOR.x + LAYOUT.FLOOR.w - 120),
      y: rng.range(LAYOUT.FLOOR.y + LAYOUT.FLOOR.h - 70, LAYOUT.FLOOR.y + LAYOUT.FLOOR.h - 18),
    },
    targetPetId: null,
    approachTime: 0,
    line: rng.pick(CUSTOMER_LINES.arrive),
    lineTime: 3,
    animPhase: rng.range(0, 6.28),
    facing: -1,
    result: null, // 'adopted' | 'left'
  };
}

/** How appealing a pet is to this customer, 0..100+. */
export function matchScore(customer, pet, shopClean = 100) {
  const cond = condition(pet);
  let score = cond * 0.5 + pet.needs.affection * 0.35;
  if (customer.wantSpecies && customer.wantSpecies === pet.species) score += 14;
  else if (customer.wantSpecies) score -= 10;
  if (customer.wantPersonality && customer.wantPersonality === pet.personality) score += 9;
  score += (shopClean - 60) * 0.08;
  if (pet.needs.health < 40) score -= 25;
  return score;
}

export function priceFor(pet, customer, reputation, shopClean) {
  const cond = condition(pet);
  const base = CUSTOMER.BASE_PRICE[pet.species] || 900;
  const value =
    base *
    (0.55 + cond / 140) *
    (0.85 + pet.needs.affection / 300) *
    (1 + reputation / 260) *
    (0.88 + shopClean / 800) *
    customer.budget;
  return Math.max(120, Math.round(value / 10) * 10);
}

export function bestMatch(customer, pets, shopClean) {
  let best = null;
  let bestScore = -Infinity;
  for (const pet of pets) {
    if (!isAdoptable(pet)) continue;
    const s = matchScore(customer, pet, shopClean);
    if (s > bestScore) {
      bestScore = s;
      best = pet;
    }
  }
  return best && bestScore >= CUSTOMER.MATCH_THRESHOLD ? { pet: best, score: bestScore } : null;
}

/**
 * Advances one customer. Adoption is *reported*, not executed here — the caller
 * (state.js) owns mutating money/reputation/pet list.
 * @returns {null | {type:'adopt', petId:number} | {type:'leave'}}
 */
export function updateCustomer(customer, dt, ctx) {
  customer.animPhase += dt * 4;
  if (customer.lineTime > 0) customer.lineTime -= dt;

  if (customer.state === 'done') return null;

  if (customer.state !== 'adopt') {
    customer.patience -= dt;
    if (customer.patience <= 0 && customer.state !== 'leave') {
      customer.state = 'leave';
      customer.target = { x: DOOR.x, y: DOOR.y };
      customer.line = ctx.rng.pick(CUSTOMER_LINES.leave);
      customer.lineTime = 2.5;
      customer.result = 'left';
    }
  }

  const arrived = moveToward(customer, dt, 62);

  switch (customer.state) {
    case 'enter':
      if (arrived) customer.state = 'browse';
      break;
    case 'browse': {
      customer.browse -= dt;
      if (customer.browse <= 0) {
        const match = bestMatch(customer, ctx.pets, ctx.shopClean);
        if (match) {
          customer.state = 'approach';
          customer.targetPetId = match.pet.id;
          // Aim at the pet straight away: the next tick starts walking there
          // instead of adopting from wherever the browsing stop happened to be.
          customer.target = { x: match.pet.pos.x + 42, y: match.pet.pos.y + 8 };
          customer.approachTime = 0;
          customer.line = ctx.rng.pick(CUSTOMER_LINES.happy);
          customer.lineTime = 3;
        } else {
          customer.browse = 3.5; // look around a bit more
          customer.target = {
            x: ctx.rng.range(LAYOUT.FLOOR.x + 120, LAYOUT.FLOOR.x + LAYOUT.FLOOR.w - 110),
            y: ctx.rng.range(LAYOUT.FLOOR.y + LAYOUT.FLOOR.h - 70, LAYOUT.FLOOR.y + LAYOUT.FLOOR.h - 18),
          };
        }
      }
      break;
    }
    case 'approach': {
      const pet = ctx.pets.find((p) => p.id === customer.targetPetId);
      if (!pet) {
        // The pet vanished (adopted by someone else) — go back to browsing.
        customer.state = 'browse';
        customer.browse = 2.5;
        customer.targetPetId = null;
        break;
      }
      customer.target = { x: pet.pos.x + 42, y: pet.pos.y + 8 };
      customer.approachTime = (customer.approachTime || 0) + dt;
      const reach = Math.hypot(customer.pos.x - customer.target.x, customer.pos.y - customer.target.y);
      // `arrived` describes the target from the *start* of this tick, so the
      // decision uses the real distance. The timeout keeps a customer from
      // chasing a pet that keeps wandering off.
      if (reach < 30 || customer.approachTime > 10) {
        customer.state = 'adopt';
        return { type: 'adopt', petId: pet.id };
      }
      break;
    }
    case 'adopt':
      customer.state = 'leave';
      customer.target = { x: DOOR.x, y: DOOR.y };
      customer.result = 'adopted';
      break;
    case 'leave':
      if (arrived) {
        customer.state = 'done';
        return { type: 'leave' };
      }
      break;
    default:
      break;
  }
  return null;
}

function moveToward(customer, dt, speed) {
  if (!customer.target) return true;
  const dx = customer.target.x - customer.pos.x;
  const dy = customer.target.y - customer.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 3) return true;
  const step = Math.min(dist, speed * dt);
  customer.pos.x += (dx / dist) * step;
  customer.pos.y += (dy / dist) * step;
  if (Math.abs(dx) > 1) customer.facing = dx > 0 ? 1 : -1;
  return dist - step < 3;
}

/** Seconds until the next customer walks in. */
export function spawnInterval(reputation, upgrades, shopClean) {
  const eff = upgradeEffects(upgrades || {});
  const repFactor = 1 - clamp(reputation, 0, 140) / 240;
  const cleanFactor = 1 + (70 - clamp(shopClean, 0, 100)) / 220;
  const raw = CUSTOMER.BASE_INTERVAL * repFactor * eff.customerInterval * cleanFactor;
  return clamp(raw, CUSTOMER.MIN_INTERVAL, CUSTOMER.BASE_INTERVAL * 1.4);
}
