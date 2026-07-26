import { NEEDS, ACTIONS, LAYOUT, clamp, upgradeEffects } from './balance.js';
import { DOG_NAMES, CAT_NAMES, DOG_BREEDS, CAT_BREEDS, PERSONALITIES, personalityById } from './data.js';

let nextPetId = 1;
/** Reset the id counter — only used by tests that assert on ids. */
export function _resetPetIds(v = 1) {
  nextPetId = v;
}

export function createPet(rng, { species, day = 1 } = {}) {
  const kind = species || (rng.chance(0.5) ? 'dog' : 'cat');
  const breeds = kind === 'dog' ? DOG_BREEDS : CAT_BREEDS;
  const names = kind === 'dog' ? DOG_NAMES : CAT_NAMES;
  const breedIndex = rng.int(0, breeds.length - 1);
  const personality = rng.pick(PERSONALITIES);
  const floor = LAYOUT.FLOOR;

  return {
    id: nextPetId++,
    species: kind,
    name: rng.pick(names),
    breedIndex,
    breedName: breeds[breedIndex].name,
    personality: personality.id,
    arrivedDay: day,
    ageMonths: rng.int(2, 10),
    scale: 0.92 + rng.next() * 0.2,
    needs: {
      hunger: rng.range(58, 82),
      clean: rng.range(58, 84),
      energy: rng.range(62, 92),
      affection: rng.range(8, 22),
      health: rng.range(78, 96),
    },
    state: 'idle', // idle | walk | sleep | eat | play
    stateTime: 0,
    pos: { x: rng.range(floor.x + 60, floor.x + floor.w - 60), y: rng.range(floor.y + 40, floor.y + floor.h - 20) },
    target: null,
    facing: rng.chance(0.5) ? 1 : -1,
    animPhase: rng.range(0, Math.PI * 2),
    blinkTimer: rng.range(1, 4),
    blink: 0,
    cooldowns: { feed: 0, brush: 0, play: 0, pet: 0 },
    reaction: null, // { text, time }
    reactionTime: 0,
    sickAlerted: false,
    lifetimeCare: 0,
  };
}

/** 0..100 overall condition — this is what customers judge and what prices scale on. */
export function condition(pet) {
  const n = pet.needs;
  return clamp(n.hunger * 0.28 + n.clean * 0.24 + n.health * 0.32 + n.energy * 0.16, 0, 100);
}

export function moodOf(pet) {
  const c = condition(pet);
  const n = pet.needs;
  if (n.health < 30) return { id: 'sick', label: 'ぐったり' };
  if (n.hunger < 25) return { id: 'hungry', label: 'おなかペコペコ' };
  if (n.clean < 25) return { id: 'dirty', label: 'よごれてる' };
  if (pet.state === 'sleep') return { id: 'sleep', label: 'すやすや' };
  if (c > 78 && n.affection > 60) return { id: 'love', label: 'ごきげん' };
  if (c > 62) return { id: 'happy', label: 'たのしそう' };
  if (c > 40) return { id: 'ok', label: 'ふつう' };
  return { id: 'sad', label: 'しょんぼり' };
}

/** The single most urgent need, used for the thought bubble above the pet. */
export function urgentNeed(pet) {
  const n = pet.needs;
  const candidates = [
    { id: 'health', v: n.health, icon: 'cross' },
    { id: 'hunger', v: n.hunger, icon: 'bowl' },
    { id: 'clean', v: n.clean, icon: 'brush' },
    { id: 'affection', v: n.affection, icon: 'heart' },
  ];
  candidates.sort((a, b) => a.v - b.v);
  const worst = candidates[0];
  if (worst.v > 45) return null;
  return worst;
}

export function isAdoptable(pet) {
  return condition(pet) >= 45 && pet.needs.affection >= 25;
}

function say(pet, text) {
  pet.reaction = text;
  pet.reactionTime = 2.2;
}

/**
 * Applies a care action.
 * @returns {{ok:boolean, reason?:string, cost:number, effects?:object}}
 */
export function applyCare(pet, actionId, ctx = {}) {
  const action = ACTIONS[actionId];
  if (!action) return { ok: false, reason: 'unknown', cost: 0 };
  if ((pet.cooldowns[actionId] || 0) > 0) {
    return { ok: false, reason: 'cooldown', cost: 0 };
  }

  const n = pet.needs;
  const pers = personalityById(pet.personality);

  if (actionId === 'feed') {
    if (n.hunger > 88) {
      say(pet, 'おなかいっぱい…');
      return { ok: false, reason: 'full', cost: 0 };
    }
    if ((ctx.money ?? Infinity) < action.cost) return { ok: false, reason: 'money', cost: 0 };
    n.hunger = clamp(n.hunger + action.hunger, 0, 100);
    n.energy = clamp(n.energy + action.energy, 0, 100);
    n.affection = clamp(n.affection + action.affection * (pers.affectionGain ?? 1), 0, 100);
    pet.state = 'eat';
    pet.stateTime = 2.4;
    pet.target = null;
    say(pet, 'もぐもぐ♪');
  } else if (actionId === 'brush') {
    if (n.clean > 92) {
      say(pet, 'ピカピカだよ！');
      return { ok: false, reason: 'clean', cost: 0 };
    }
    n.clean = clamp(n.clean + action.clean, 0, 100);
    n.affection = clamp(n.affection + action.affection * (pers.affectionGain ?? 1), 0, 100);
    say(pet, 'きもちいい〜');
  } else if (actionId === 'play') {
    if (n.energy < 22) {
      say(pet, 'つかれちゃった…');
      return { ok: false, reason: 'tired', cost: 0 };
    }
    if (pet.state === 'sleep') {
      say(pet, 'zzz…');
      return { ok: false, reason: 'asleep', cost: 0 };
    }
    n.energy = clamp(n.energy + action.energy, 0, 100);
    n.clean = clamp(n.clean + action.clean, 0, 100);
    n.affection = clamp(n.affection + action.affection * pers.play * (pers.affectionGain ?? 1), 0, 100);
    pet.state = 'play';
    pet.stateTime = 3;
    say(pet, pet.species === 'dog' ? 'ワンワン！' : 'にゃーん！');
  } else if (actionId === 'pet') {
    if (pet.state === 'sleep') {
      n.affection = clamp(n.affection + 1, 0, 100);
      say(pet, 'zzz…');
      return { ok: true, cost: 0, gentle: true };
    }
    n.affection = clamp(n.affection + action.affection * pers.pet * (pers.affectionGain ?? 1), 0, 100);
    say(pet, pet.species === 'dog' ? 'くぅーん♪' : 'ゴロゴロ…');
  } else {
    return { ok: false, reason: 'not-a-pet-action', cost: 0 };
  }

  pet.cooldowns[actionId] = action.cooldown;
  pet.lifetimeCare += 1;
  return { ok: true, cost: action.cost };
}

/** Per-step need decay + tiny behaviour state machine. */
export function updatePet(pet, dt, ctx) {
  const n = pet.needs;
  const eff = upgradeEffects(ctx.upgrades || {});
  const pers = personalityById(pet.personality);

  for (const k of Object.keys(pet.cooldowns)) {
    if (pet.cooldowns[k] > 0) pet.cooldowns[k] = Math.max(0, pet.cooldowns[k] - dt);
  }
  if (pet.reactionTime > 0) {
    pet.reactionTime -= dt;
    if (pet.reactionTime <= 0) pet.reaction = null;
  }

  const sleeping = pet.state === 'sleep';
  n.hunger = clamp(n.hunger - NEEDS.HUNGER_DECAY * eff.hungerRate * dt * (sleeping ? 0.5 : 1), 0, 100);
  n.clean = clamp(n.clean - NEEDS.CLEAN_DECAY * dt * (sleeping ? 0.4 : 1), 0, 100);
  n.affection = clamp(n.affection - NEEDS.AFFECTION_DECAY * dt, 0, 100);
  if (sleeping) {
    n.energy = clamp(n.energy + NEEDS.SLEEP_ENERGY_GAIN * dt, 0, 100);
  } else {
    n.energy = clamp(n.energy - NEEDS.ENERGY_DECAY * pers.restless * dt, 0, 100);
  }

  const distressed = n.hunger < NEEDS.DISTRESS_THRESHOLD || n.clean < NEEDS.DISTRESS_THRESHOLD;
  if (distressed) {
    n.health = clamp(n.health - NEEDS.HEALTH_DRAIN * dt, 0, 100);
  } else if (n.hunger > 45 && n.clean > 40) {
    n.health = clamp(n.health + NEEDS.HEALTH_RECOVER * dt, 0, 100);
  }

  updateBehaviour(pet, dt, ctx);
}

function updateBehaviour(pet, dt, ctx) {
  const rng = ctx.rng;
  const floor = LAYOUT.FLOOR;
  const pers = personalityById(pet.personality);
  pet.animPhase += dt * (pet.state === 'play' ? 9 : 3);

  pet.blinkTimer -= dt;
  if (pet.blinkTimer <= 0) {
    pet.blink = 0.16;
    pet.blinkTimer = 2.2 + rng.next() * 3.5;
  }
  if (pet.blink > 0) pet.blink = Math.max(0, pet.blink - dt);

  if (pet.stateTime > 0) {
    pet.stateTime -= dt;
    if (pet.stateTime <= 0 && (pet.state === 'eat' || pet.state === 'play')) {
      pet.state = 'idle';
      pet.stateTime = rng.range(0.6, 2);
    }
  }

  if (pet.state === 'sleep') {
    if (pet.needs.energy >= NEEDS.WAKE_ENERGY) {
      pet.state = 'idle';
      pet.stateTime = rng.range(0.5, 1.5);
    }
    return;
  }
  if (pet.state === 'eat' || pet.state === 'play') return;

  if (pet.needs.energy < NEEDS.SLEEP_TRIGGER) {
    pet.state = 'sleep';
    pet.target = null;
    return;
  }

  if (pet.state === 'idle') {
    if (pet.stateTime <= 0) {
      if (rng.chance(0.7 * pers.restless)) {
        pet.target = {
          x: rng.range(floor.x + 40, floor.x + floor.w - 40),
          y: rng.range(floor.y + 30, floor.y + floor.h - 16),
        };
        pet.state = 'walk';
      } else {
        pet.stateTime = rng.range(1, 3);
      }
    }
    return;
  }

  if (pet.state === 'walk') {
    if (!pet.target) {
      pet.state = 'idle';
      pet.stateTime = rng.range(0.8, 2);
      return;
    }
    const speed = 42 * pers.restless * (0.6 + pet.needs.energy / 160);
    const dx = pet.target.x - pet.pos.x;
    const dy = pet.target.y - pet.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      pet.pos.x = pet.target.x;
      pet.pos.y = pet.target.y;
      pet.target = null;
      pet.state = 'idle';
      pet.stateTime = rng.range(0.8, 2.5);
      return;
    }
    const step = Math.min(dist, speed * dt);
    pet.pos.x += (dx / dist) * step;
    pet.pos.y += (dy / dist) * step;
    if (Math.abs(dx) > 2) pet.facing = dx > 0 ? 1 : -1;
    pet.pos.x = clamp(pet.pos.x, floor.x + 28, floor.x + floor.w - 28);
    pet.pos.y = clamp(pet.pos.y, floor.y + 20, floor.y + floor.h - 10);
  }
}
