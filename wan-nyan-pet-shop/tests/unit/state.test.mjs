import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASES, createGame, startGame, step, interact, setTool, closeDay, nextDay,
  openShopScreen, buyUpgrade, restock, upgradeCost, capacity, shopCleanliness, condition,
} from '../../src/game/state.js';
import { ACTIONS, DAY, VET, RESTOCK_COST, UPGRADES } from '../../src/game/balance.js';
import { EventBus } from '../../src/core/events.js';

function newOpenGame(seed = 42) {
  const g = createGame({ seed });
  startGame(g);
  return g;
}

function healthy(pet) {
  Object.assign(pet.needs, { hunger: 95, clean: 95, energy: 95, health: 100, affection: 90 });
}

test('a fresh game starts on the title screen with starting funds and pets', () => {
  const g = createGame({ seed: 1 });
  assert.equal(g.phase, PHASES.TITLE);
  assert.equal(g.money, DAY.START_MONEY);
  assert.equal(g.pets.length, DAY.START_PETS);
  assert.equal(g.day, 1);
});

test('the same seed replays identically', () => {
  const a = createGame({ seed: 777 });
  const b = createGame({ seed: 777 });
  startGame(a);
  startGame(b);
  for (let i = 0; i < 900; i++) {
    step(a, 1 / 30);
    step(b, 1 / 30);
  }
  assert.equal(a.money, b.money);
  assert.equal(a.pets.length, b.pets.length);
  assert.deepEqual(a.pets.map((p) => Math.round(p.needs.hunger)), b.pets.map((p) => Math.round(p.needs.hunger)));
});

test('interact() is ignored outside the open phase', () => {
  const g = createGame({ seed: 2 });
  const pet = g.pets[0];
  const res = interact(g, pet.pos.x, pet.pos.y);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'phase');
});

test('clicking a pet with the feed tool spends money and feeds it', () => {
  const g = newOpenGame();
  const pet = g.pets[0];
  pet.needs.hunger = 30;
  setTool(g, 'feed');
  const before = g.money;
  const res = interact(g, pet.pos.x, pet.pos.y + 10);
  assert.equal(res.ok, true, `feed failed: ${res.reason}`);
  assert.equal(g.money, before - ACTIONS.feed.cost);
  assert.ok(pet.needs.hunger > 30);
  assert.equal(g.selectedPetId, pet.id);
});

test('a failed action costs nothing', () => {
  const g = newOpenGame();
  const pet = g.pets[0];
  pet.needs.hunger = 99;
  setTool(g, 'feed');
  const before = g.money;
  const res = interact(g, pet.pos.x, pet.pos.y + 10);
  assert.equal(res.ok, false);
  assert.equal(g.money, before);
});

test('feeding is blocked when the shop cannot afford food', () => {
  const g = newOpenGame();
  g.money = 5;
  const pet = g.pets[0];
  pet.needs.hunger = 20;
  setTool(g, 'feed');
  const res = interact(g, pet.pos.x, pet.pos.y + 10);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'money');
  assert.equal(g.money, 5);
});

test('clicking empty floor selects nothing and changes no state', () => {
  const g = newOpenGame();
  const snapshot = g.money;
  const res = interact(g, 5, 500);
  assert.equal(res.ok, false);
  assert.equal(g.money, snapshot);
});

test('the cleaning tool removes a mess and improves shop cleanliness', () => {
  const g = newOpenGame();
  g.messes.push({ id: 999, x: 400, y: 400, kind: 'fur', rot: 0 });
  const before = shopCleanliness(g);
  setTool(g, 'clean');
  const res = interact(g, 400, 400);
  assert.equal(res.ok, true);
  assert.equal(g.messes.length, 0);
  assert.ok(shopCleanliness(g) > before);
});

test('messes accumulate while the shop is open, but stay capped', () => {
  const g = newOpenGame(5);
  for (let i = 0; i < 30 * 600; i++) step(g, 1 / 30);
  assert.ok(g.messes.length <= 8);
});

test('a pet whose health hits zero goes to the vet instead of dying', () => {
  const g = newOpenGame();
  const pet = g.pets[0];
  const before = g.money;
  pet.needs.health = 0.01;
  pet.needs.hunger = 0;
  step(g, 1 / 30);
  assert.equal(g.pets.length, 2);
  assert.ok(pet.needs.health >= VET.RESTORE);
  assert.equal(g.money, before - VET.FEE);
});

test('an adoption pays the shop, raises reputation and fills the album', () => {
  const g = newOpenGame(31);
  g.pets.forEach(healthy);
  const before = { money: g.money, rep: g.reputation, pets: g.pets.length };
  let guard = 0;
  while (g.stats.adoptions === 0 && guard++ < 30 * 600) step(g, 1 / 30);
  assert.equal(g.stats.adoptions >= 1, true, 'no adoption happened in one long day');
  assert.ok(g.money > before.money);
  assert.ok(g.reputation > before.rep);
  assert.equal(g.album.length, g.stats.adoptions);
  assert.ok(g.album[0].price > 0);
});

test('the day closes automatically and produces a report', () => {
  const g = newOpenGame(8);
  for (let i = 0; i < 30 * (DAY.LENGTH + 1); i++) step(g, 1 / 30);
  assert.equal(g.phase, PHASES.REPORT);
  assert.ok(g.lastReport);
  assert.equal(g.lastReport.day, 1);
  assert.equal(g.lastReport.rent, DAY.RENT_BASE + DAY.RENT_PER_PET * g.pets.length);
  assert.equal(g.customers.length, 0);
});

test('closing the day charges rent once', () => {
  const g = newOpenGame(9);
  const before = g.money;
  const report = closeDay(g);
  assert.equal(g.money, before - report.rent);
  assert.equal(closeDay(g), null, 'closeDay must be idempotent outside the open phase');
});

test('running out of money ends the game', () => {
  const g = newOpenGame(10);
  g.money = 10;
  closeDay(g);
  assert.equal(g.phase, PHASES.GAMEOVER);
});

test('reaching the reputation goal triggers the ending once', () => {
  const g = newOpenGame(11);
  g.reputation = DAY.GOAL_REPUTATION;
  g.pets.forEach(healthy);
  closeDay(g);
  assert.equal(g.phase, PHASES.ENDING);
  assert.equal(g.goalReached, true);
  openShopScreen(g);
  nextDay(g);
  g.reputation = DAY.GOAL_REPUTATION + 10;
  closeDay(g);
  assert.equal(g.phase, PHASES.REPORT, 'the ending should not repeat every day');
});

test('the next day resets the clock, clears messes and rests the pets', () => {
  const g = newOpenGame(12);
  g.pets[0].needs.energy = 10;
  g.messes.push({ id: 1, x: 100, y: 300, kind: 'fur', rot: 0 });
  closeDay(g);
  openShopScreen(g);
  const energyBefore = g.pets[0].needs.energy;
  nextDay(g);
  assert.equal(g.phase, PHASES.OPEN);
  assert.equal(g.day, 2);
  assert.equal(g.timeInDay, 0);
  assert.equal(g.messes.length, 0);
  assert.ok(g.pets[0].needs.energy > energyBefore);
  assert.equal(g.today.income, 0);
});

test('the shop is never left with zero pets after a night', () => {
  const g = newOpenGame(13);
  g.pets.length = 0;
  closeDay(g);
  openShopScreen(g);
  nextDay(g);
  assert.ok(g.pets.length >= 1);
});

test('new arrivals never exceed bed capacity', () => {
  const g = newOpenGame(14);
  for (let day = 0; day < 40; day++) {
    closeDay(g);
    if (g.phase === PHASES.GAMEOVER) break;
    openShopScreen(g);
    nextDay(g);
    g.money = 99999;
    assert.ok(g.pets.length <= capacity(g), `${g.pets.length} pets vs ${capacity(g)} beds`);
  }
});

test('buying an upgrade costs money, raises the level and eventually maxes out', () => {
  const g = newOpenGame(15);
  g.money = 999999;
  const def = UPGRADES.find((u) => u.id === 'bed');
  for (let i = 0; i < def.max; i++) {
    const cost = upgradeCost(g, 'bed');
    const before = g.money;
    const res = buyUpgrade(g, 'bed');
    assert.equal(res.ok, true);
    assert.equal(g.money, before - cost);
  }
  assert.equal(upgradeCost(g, 'bed'), null);
  assert.deepEqual(buyUpgrade(g, 'bed'), { ok: false, reason: 'maxed' });
  assert.equal(capacity(g), 3 + def.max);
});

test('upgrades cannot be bought without the money', () => {
  const g = newOpenGame(16);
  g.money = 0;
  assert.deepEqual(buyUpgrade(g, 'food'), { ok: false, reason: 'money' });
  assert.equal(g.upgrades.food, 0);
});

test('restocking adds a pet, respects capacity and charges the fee', () => {
  const g = newOpenGame(17);
  g.money = 99999;
  while (g.pets.length < capacity(g)) {
    const before = g.money;
    const res = restock(g);
    assert.equal(res.ok, true);
    assert.equal(g.money, before - RESTOCK_COST);
  }
  assert.deepEqual(restock(g), { ok: false, reason: 'full' });
});

test('events reach the bus so audio and particles can react', () => {
  const bus = new EventBus();
  const seen = [];
  bus.on('care', () => seen.push('care'));
  bus.on('day-start', () => seen.push('day-start'));
  const g = createGame({ seed: 18, bus });
  startGame(g);
  setTool(g, 'brush');
  g.pets[0].needs.clean = 10;
  interact(g, g.pets[0].pos.x, g.pets[0].pos.y + 10);
  assert.deepEqual(seen, ['day-start', 'care']);
});

test('a listener that throws does not break the simulation', () => {
  const bus = new EventBus();
  bus.on('care', () => {
    throw new Error('boom');
  });
  const g = createGame({ seed: 19, bus });
  startGame(g);
  setTool(g, 'brush');
  g.pets[0].needs.clean = 10;
  assert.doesNotThrow(() => interact(g, g.pets[0].pos.x, g.pets[0].pos.y + 10));
});

test('condition is re-exported for the UI layer', () => {
  const g = createGame({ seed: 20 });
  assert.ok(condition(g.pets[0]) > 0);
});
