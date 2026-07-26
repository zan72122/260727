import { Rng } from '../core/rng.js';
import {
  ACTIONS, CUSTOMER, DAY, LAYOUT, SHOP, UPGRADES, VET, RESTOCK_COST,
  bedCapacity, clamp, upgradeEffects,
} from './balance.js';
import { createPet, updatePet, applyCare, condition, isAdoptable, _resetPetIds } from './pets.js';
import { createCustomer, updateCustomer, priceFor, spawnInterval, _resetCustomerIds } from './customers.js';

export const PHASES = {
  TITLE: 'title',
  OPEN: 'open',
  REPORT: 'report',
  SHOP: 'shop',
  ENDING: 'ending',
  GAMEOVER: 'gameover',
};

const LOG_MAX = 24;
const MESS_KINDS = ['fur', 'puddle', 'paw'];
const CLICK_RADIUS_PET = 52;
const CLICK_RADIUS_MESS = 34;

let nextMessId = 1;

export function createGame({ seed = 20260727, bus = null } = {}) {
  _resetPetIds(1);
  _resetCustomerIds(1);
  nextMessId = 1;
  const rng = new Rng(seed);
  const state = {
    version: 1,
    seed,
    rng,
    bus,
    phase: PHASES.TITLE,
    day: 1,
    timeInDay: 0,
    dayLength: DAY.LENGTH,
    money: DAY.START_MONEY,
    reputation: DAY.START_REPUTATION,
    upgrades: { bed: 0, food: 0, poster: 0, groomer: 0 },
    pets: [],
    customers: [],
    messes: [],
    album: [], // adopted pets, kept as keepsakes
    selectedPetId: null,
    tool: 'pet',
    spawnTimer: 14,
    messTimer: SHOP.MESS_INTERVAL,
    log: [],
    today: newDayLedger(),
    stats: { adoptions: 0, earned: 0, spent: 0, careActions: 0, daysPlayed: 0, bestDay: 0 },
    goalReached: false,
    lastReport: null,
    elapsed: 0,
  };
  for (let i = 0; i < DAY.START_PETS; i++) state.pets.push(createPet(rng, { day: 1 }));
  return state;
}

function newDayLedger() {
  return { income: 0, food: 0, vet: 0, adoptions: 0, care: 0, leavers: 0 };
}

export function shopCleanliness(state) {
  return clamp(100 - state.messes.length * SHOP.SHOP_CLEAN_PER_MESS, 0, 100);
}

export function capacity(state) {
  return bedCapacity(state.upgrades);
}

export function pushLog(state, text, kind = 'info') {
  state.log.unshift({ text, kind, at: state.elapsed });
  if (state.log.length > LOG_MAX) state.log.length = LOG_MAX;
  state.bus?.emit('log', { text, kind });
}

export function startGame(state) {
  if (state.phase !== PHASES.TITLE) return;
  state.phase = PHASES.OPEN;
  state.timeInDay = 0;
  pushLog(state, `${state.day}日目 かいてん！ いらっしゃいませ〜`, 'day');
  state.bus?.emit('day-start', { day: state.day });
}

/* ------------------------------------------------------------------ */
/* Simulation step                                                     */
/* ------------------------------------------------------------------ */

export function step(state, dt) {
  state.elapsed += dt;
  if (state.phase !== PHASES.OPEN) return;

  state.timeInDay += dt;
  const shopClean = shopCleanliness(state);

  for (const pet of state.pets) {
    updatePet(pet, dt, { rng: state.rng, upgrades: state.upgrades });
    if (pet.needs.health <= 0) sendToVet(state, pet);
  }

  updateMessSpawner(state, dt);
  updateCustomers(state, dt, shopClean);

  if (state.timeInDay >= state.dayLength) closeDay(state);
}

function updateMessSpawner(state, dt) {
  if (state.pets.length === 0) return;
  const eff = upgradeEffects(state.upgrades);
  state.messTimer -= dt * state.pets.length;
  if (state.messTimer <= 0) {
    state.messTimer = SHOP.MESS_INTERVAL * eff.messInterval * state.rng.range(0.8, 1.3);
    if (state.messes.length < SHOP.MESS_MAX) {
      const f = LAYOUT.FLOOR;
      state.messes.push({
        id: nextMessId++,
        x: state.rng.range(f.x + 30, f.x + f.w - 30),
        y: state.rng.range(f.y + 26, f.y + f.h - 12),
        kind: state.rng.pick(MESS_KINDS),
        rot: state.rng.range(0, Math.PI * 2),
      });
    }
  }
}

function updateCustomers(state, dt, shopClean) {
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = spawnInterval(state.reputation, state.upgrades, shopClean);
    const active = state.customers.filter((c) => c.state !== 'done').length;
    if (active < CUSTOMER.MAX_ON_FLOOR && state.pets.length > 0) {
      state.customers.push(createCustomer(state.rng, state.day));
      state.bus?.emit('customer-enter');
    }
  }

  const ctx = { rng: state.rng, pets: state.pets, shopClean };
  for (const c of state.customers) {
    const outcome = updateCustomer(c, dt, ctx);
    if (!outcome) continue;
    if (outcome.type === 'adopt') completeAdoption(state, c, outcome.petId, shopClean);
    else if (outcome.type === 'leave' && c.result !== 'adopted') {
      state.reputation = clamp(state.reputation + CUSTOMER.REPUTATION_ON_LEAVE, 0, 200);
      state.today.leavers++;
      pushLog(state, 'お客さんが 何も選ばずに帰ってしまった…', 'bad');
    }
  }
  state.customers = state.customers.filter((c) => c.state !== 'done');
}

function completeAdoption(state, customer, petId, shopClean) {
  const idx = state.pets.findIndex((p) => p.id === petId);
  if (idx < 0) return;
  const pet = state.pets[idx];
  const price = priceFor(pet, customer, state.reputation, shopClean);
  state.pets.splice(idx, 1);
  if (state.selectedPetId === petId) state.selectedPetId = state.pets[0]?.id ?? null;

  state.money += price;
  state.stats.earned += price;
  state.stats.adoptions++;
  state.today.income += price;
  state.today.adoptions++;
  const bonus = CUSTOMER.REPUTATION_ON_ADOPT * (0.7 + condition(pet) / 200 + pet.needs.affection / 400);
  state.reputation = clamp(state.reputation + bonus, 0, 200);
  state.album.push({
    name: pet.name,
    species: pet.species,
    breedName: pet.breedName,
    breedIndex: pet.breedIndex,
    day: state.day,
    price,
    affection: Math.round(pet.needs.affection),
  });
  pushLog(state, `${pet.name}が 新しいおうちへ！  +${price}円`, 'good');
  state.bus?.emit('adopt', { pet, price });
}

function sendToVet(state, pet) {
  pet.needs.health = VET.RESTORE;
  pet.needs.hunger = Math.max(pet.needs.hunger, 45);
  pet.needs.clean = Math.max(pet.needs.clean, 45);
  state.money -= VET.FEE;
  state.stats.spent += VET.FEE;
  state.today.vet += VET.FEE;
  state.reputation = clamp(state.reputation - 3, 0, 200);
  pushLog(state, `${pet.name}を 動物病院へ… -${VET.FEE}円`, 'bad');
  state.bus?.emit('vet', { pet });
}

/* ------------------------------------------------------------------ */
/* Player interaction                                                  */
/* ------------------------------------------------------------------ */

export function setTool(state, tool) {
  if (ACTIONS[tool]) state.tool = tool;
}

export function petAt(state, x, y) {
  let best = null;
  let bestD = CLICK_RADIUS_PET;
  for (const pet of state.pets) {
    const d = Math.hypot(pet.pos.x - x, pet.pos.y - y - 10);
    if (d < bestD) {
      bestD = d;
      best = pet;
    }
  }
  return best;
}

export function messAt(state, x, y) {
  let best = null;
  let bestD = CLICK_RADIUS_MESS;
  for (const m of state.messes) {
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

/**
 * Handles a click inside the play area with the currently selected tool.
 * @returns {{kind:string, ok:boolean, petId?:number, reason?:string}}
 */
export function interact(state, x, y) {
  if (state.phase !== PHASES.OPEN) return { kind: 'none', ok: false, reason: 'phase' };

  if (state.tool === 'clean') {
    const mess = messAt(state, x, y);
    if (mess) {
      state.messes = state.messes.filter((m) => m.id !== mess.id);
      state.stats.careActions++;
      state.today.care++;
      state.bus?.emit('clean', { x: mess.x, y: mess.y });
      return { kind: 'clean', ok: true };
    }
    return { kind: 'clean', ok: false, reason: 'nothing' };
  }

  const pet = petAt(state, x, y);
  if (!pet) return { kind: 'miss', ok: false, reason: 'nothing' };
  state.selectedPetId = pet.id;

  const action = ACTIONS[state.tool];
  if (!action) return { kind: 'select', ok: true, petId: pet.id };
  if (state.tool === 'feed' && state.money < action.cost) {
    pushLog(state, 'お金が足りません…', 'bad');
    return { kind: 'feed', ok: false, petId: pet.id, reason: 'money' };
  }

  const res = applyCare(pet, state.tool, { money: state.money });
  if (res.ok) {
    if (res.cost) {
      state.money -= res.cost;
      state.stats.spent += res.cost;
      state.today.food += res.cost;
    }
    state.stats.careActions++;
    state.today.care++;
    state.bus?.emit('care', { pet, action: state.tool, gentle: res.gentle === true });
  } else {
    state.bus?.emit('care-fail', { pet, action: state.tool, reason: res.reason });
  }
  return { kind: state.tool, ok: res.ok, petId: pet.id, reason: res.reason };
}

/* ------------------------------------------------------------------ */
/* Day boundary                                                        */
/* ------------------------------------------------------------------ */

export function closeDay(state) {
  if (state.phase !== PHASES.OPEN) return null;
  const rent = DAY.RENT_BASE + DAY.RENT_PER_PET * state.pets.length;
  const avgCond = state.pets.length
    ? state.pets.reduce((s, p) => s + condition(p), 0) / state.pets.length
    : 60;
  const careBonus = (avgCond - 55) / 10;
  state.reputation = clamp(state.reputation + careBonus, 0, 200);
  state.money -= rent;
  state.stats.spent += rent;
  state.stats.daysPlayed++;
  state.stats.bestDay = Math.max(state.stats.bestDay, state.today.income);

  const report = {
    day: state.day,
    income: state.today.income,
    adoptions: state.today.adoptions,
    food: state.today.food,
    vet: state.today.vet,
    rent,
    careActions: state.today.care,
    leavers: state.today.leavers,
    avgCondition: Math.round(avgCond),
    reputation: Math.round(state.reputation),
    careBonus: Math.round(careBonus * 10) / 10,
    profit: state.today.income - state.today.food - state.today.vet - rent,
    money: Math.round(state.money),
  };
  state.lastReport = report;
  state.customers = [];

  if (state.money < 0) {
    state.phase = PHASES.GAMEOVER;
    pushLog(state, '資金が尽きてしまった… 閉店です', 'bad');
    state.bus?.emit('gameover', report);
    return report;
  }

  if (!state.goalReached && state.reputation >= DAY.GOAL_REPUTATION) {
    state.goalReached = true;
    state.phase = PHASES.ENDING;
    pushLog(state, '町いちばんの人気店になりました！', 'good');
    state.bus?.emit('goal', report);
    return report;
  }

  state.phase = PHASES.REPORT;
  state.bus?.emit('day-end', report);
  return report;
}

/** Report screen → upgrade screen. */
export function openShopScreen(state) {
  if (state.phase === PHASES.REPORT || state.phase === PHASES.ENDING) state.phase = PHASES.SHOP;
}

export function nextDay(state) {
  if (state.phase !== PHASES.SHOP && state.phase !== PHASES.REPORT) return;
  state.day++;
  state.timeInDay = 0;
  state.today = newDayLedger();
  state.messes = [];
  state.customers = [];
  state.spawnTimer = 12;
  state.messTimer = SHOP.MESS_INTERVAL;
  for (const pet of state.pets) {
    // A night's rest: pets sleep, recover energy, and get a little hungrier.
    pet.needs.energy = clamp(pet.needs.energy + 45, 0, 100);
    pet.needs.hunger = clamp(pet.needs.hunger - 12, 0, 100);
    pet.needs.health = clamp(pet.needs.health + 8, 0, 100);
    pet.state = 'idle';
    pet.stateTime = 0.5;
    for (const k of Object.keys(pet.cooldowns)) pet.cooldowns[k] = 0;
  }
  // Every free bed can receive a new arrival overnight (capped so the shop
  // never fills up in a single night and the player keeps choosing).
  const free = capacity(state) - state.pets.length;
  const slots = Math.min(free, DAY.MAX_ARRIVALS);
  for (let i = 0; i < slots; i++) {
    if (!state.rng.chance(DAY.ARRIVAL_CHANCE)) continue;
    const pet = createPet(state.rng, { day: state.day });
    state.pets.push(pet);
    pushLog(state, `新しい子が来ました： ${pet.name}（${pet.breedName}）`, 'good');
    state.bus?.emit('arrival', { pet });
  }
  if (state.pets.length === 0) {
    const pet = createPet(state.rng, { day: state.day });
    state.pets.push(pet);
    pushLog(state, `${pet.name}が 保護されて やってきました`, 'good');
  }
  if (state.selectedPetId && !state.pets.some((p) => p.id === state.selectedPetId)) {
    state.selectedPetId = state.pets[0]?.id ?? null;
  }
  state.phase = PHASES.OPEN;
  pushLog(state, `${state.day}日目 かいてん！`, 'day');
  state.bus?.emit('day-start', { day: state.day });
}

/* ------------------------------------------------------------------ */
/* Shop screen                                                         */
/* ------------------------------------------------------------------ */

export function upgradeCost(state, id) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return null;
  const level = state.upgrades[id] || 0;
  if (level >= def.max) return null;
  return def.cost[level];
}

export function buyUpgrade(state, id) {
  const cost = upgradeCost(state, id);
  if (cost == null) return { ok: false, reason: 'maxed' };
  if (state.money < cost) return { ok: false, reason: 'money' };
  state.money -= cost;
  state.stats.spent += cost;
  state.upgrades[id] = (state.upgrades[id] || 0) + 1;
  const def = UPGRADES.find((u) => u.id === id);
  pushLog(state, `${def.name} を購入しました`, 'good');
  state.bus?.emit('purchase', { id, cost });
  return { ok: true, cost };
}

export function restock(state) {
  if (state.pets.length >= capacity(state)) return { ok: false, reason: 'full' };
  if (state.money < RESTOCK_COST) return { ok: false, reason: 'money' };
  state.money -= RESTOCK_COST;
  state.stats.spent += RESTOCK_COST;
  const pet = createPet(state.rng, { day: state.day });
  state.pets.push(pet);
  pushLog(state, `${pet.name}（${pet.breedName}）を お迎えしました`, 'good');
  state.bus?.emit('arrival', { pet });
  return { ok: true, pet };
}

export function continueAfterEnding(state) {
  if (state.phase === PHASES.ENDING) state.phase = PHASES.SHOP;
}

/* ------------------------------------------------------------------ */
/* Save / load                                                         */
/* ------------------------------------------------------------------ */

const SAVE_FIELDS = [
  'version', 'seed', 'phase', 'day', 'timeInDay', 'dayLength', 'money', 'reputation',
  'upgrades', 'pets', 'messes', 'album', 'selectedPetId', 'tool', 'spawnTimer',
  'messTimer', 'log', 'today', 'stats', 'goalReached', 'lastReport', 'elapsed',
];

export function serialize(state) {
  const out = {};
  for (const k of SAVE_FIELDS) out[k] = state[k];
  out.rngState = state.rng.serialize();
  // Customers are mid-walk actors; dropping them avoids restoring half-finished
  // adoptions and the player just sees the shop quiet for a moment.
  out.customers = [];
  return out;
}

export function deserialize(data, { bus = null } = {}) {
  const state = createGame({ seed: data.seed ?? 20260727, bus });
  for (const k of SAVE_FIELDS) {
    if (data[k] !== undefined) state[k] = data[k];
  }
  state.rng = Rng.deserialize(data.rngState ?? data.seed ?? 1);
  state.bus = bus;
  state.customers = [];
  const maxId = state.pets.reduce((m, p) => Math.max(m, p.id), 0);
  _resetPetIds(maxId + 1);
  _resetCustomerIds(1);
  nextMessId = state.messes.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  if (state.phase === PHASES.OPEN && state.pets.length === 0) {
    state.pets.push(createPet(state.rng, { day: state.day }));
  }
  return state;
}

export { condition, isAdoptable };
