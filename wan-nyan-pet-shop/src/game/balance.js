/**
 * Every tunable number in the game lives here so balancing is one file, and so
 * the unit tests can assert against the same constants the sim uses.
 * Rates are "points per simulated second" unless noted.
 */

export const LAYOUT = {
  WIDTH: 960,
  HEIGHT: 600,
  TOP_BAR_H: 58,
  TOOL_BAR_H: 92,
  FLOOR: { x: 48, y: 268, w: 864, h: 208 },
};

export const DAY = {
  LENGTH: 120, // seconds of "open" time per day
  GOAL_REPUTATION: 100,
  START_MONEY: 1500,
  START_REPUTATION: 20,
  START_PETS: 2,
  RENT_BASE: 180,
  RENT_PER_PET: 55,
  ARRIVAL_CHANCE: 0.75, // each free bed rolls this at dawn
  MAX_ARRIVALS: 6, // safety cap; bed capacity tops out at 6, so free beds usually all roll
};

export const NEEDS = {
  // decay per second while the shop is open
  HUNGER_DECAY: 0.75,
  CLEAN_DECAY: 0.42,
  ENERGY_DECAY: 0.5,
  AFFECTION_DECAY: 0.07,
  // health responds to the other needs
  HEALTH_RECOVER: 0.45,
  HEALTH_DRAIN: 1.15,
  DISTRESS_THRESHOLD: 22, // hunger/clean below this hurts health
  SLEEP_ENERGY_GAIN: 4.2,
  SLEEP_TRIGGER: 18,
  WAKE_ENERGY: 78,
};

export const ACTIONS = {
  feed: { id: 'feed', label: 'ごはん', key: '1', cost: 40, cooldown: 6, hunger: 46, affection: 4, energy: 4, icon: 'bowl', hint: 'ごはんをあげたい子を クリックしてね' },
  brush: { id: 'brush', label: 'ブラシ', key: '2', cost: 0, cooldown: 5, clean: 44, affection: 6, icon: 'brush', hint: 'ブラシをかけたい子を クリックしてね' },
  play: { id: 'play', label: 'あそぶ', key: '3', cost: 0, cooldown: 8, energy: -14, affection: 11, clean: -6, icon: 'ball', hint: 'あそびたい子を クリックしてね' },
  pet: { id: 'pet', label: 'なでる', key: '4', cost: 0, cooldown: 3, affection: 5, icon: 'hand', hint: 'なでたい子を クリックしてね' },
  clean: { id: 'clean', label: 'おそうじ', key: '5', cost: 0, cooldown: 0.35, icon: 'broom', hint: 'よごれを クリックして おそうじしよう' },
};

export const SHOP = {
  MESS_INTERVAL: 16, // seconds between mess spawns, divided by pet count
  MESS_MAX: 8,
  SHOP_CLEAN_PER_MESS: 9, // each mess drags shop cleanliness down by this much
  MESS_REWARD_CLEAN: 9,
};

export const CUSTOMER = {
  BASE_INTERVAL: 26,
  MIN_INTERVAL: 9,
  PATIENCE: 34,
  BROWSE_TIME: 6,
  MATCH_THRESHOLD: 52,
  MAX_ON_FLOOR: 3,
  BASE_PRICE: { dog: 940, cat: 880 },
  REPUTATION_ON_ADOPT: 4,
  REPUTATION_ON_LEAVE: -2.5,
};

export const VET = { FEE: 600, RESTORE: 45 };

export const UPGRADES = [
  {
    id: 'bed',
    name: 'ペットベッド増設',
    desc: 'ベッドが 1つ ふえる',
    cost: [900, 1400, 2100],
    max: 3,
  },
  {
    id: 'food',
    name: '高級フード',
    desc: '空腹の進みが 15% おそくなる',
    cost: [1100, 1800],
    max: 2,
  },
  {
    id: 'poster',
    name: '看板とチラシ',
    desc: 'お客さんの来店が はやくなる',
    cost: [800, 1500],
    max: 2,
  },
  {
    id: 'groomer',
    name: '自動空気清浄機',
    desc: '店内が よごれにくくなる',
    cost: [1200],
    max: 1,
  },
];

export const RESTOCK_COST = 500;

/** Effective multipliers derived from purchased upgrades. */
export function upgradeEffects(upgrades) {
  const food = upgrades.food || 0;
  const poster = upgrades.poster || 0;
  const groomer = upgrades.groomer || 0;
  return {
    hungerRate: 1 - 0.15 * food,
    customerInterval: 1 - 0.18 * poster,
    messInterval: 1 + 0.6 * groomer,
  };
}

export function bedCapacity(upgrades) {
  return 3 + (upgrades.bed || 0);
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
