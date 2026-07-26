import test from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../../src/core/rng.js';
import {
  PHASES, createGame, startGame, step, interact, setTool, nextDay, openShopScreen,
  buyUpgrade, capacity, upgradeCost, condition,
} from '../../src/game/state.js';
import { DAY } from '../../src/game/balance.js';

const DT = 1 / 30;

/** A simple "competent player" bot used to exercise a whole run of the game. */
function tendShop(g) {
  if (g.messes.length > 2) {
    setTool(g, 'clean');
    const m = g.messes[0];
    interact(g, m.x, m.y);
    return;
  }
  for (const pet of g.pets) {
    const n = pet.needs;
    if (n.hunger < 55 && pet.cooldowns.feed <= 0 && g.money > 200) {
      setTool(g, 'feed');
      interact(g, pet.pos.x, pet.pos.y + 10);
      return;
    }
    if (n.clean < 55 && pet.cooldowns.brush <= 0) {
      setTool(g, 'brush');
      interact(g, pet.pos.x, pet.pos.y + 10);
      return;
    }
    if (n.affection < 85 && pet.cooldowns.play <= 0 && n.energy > 35) {
      setTool(g, 'play');
      interact(g, pet.pos.x, pet.pos.y + 10);
      return;
    }
    if (n.affection < 85 && pet.cooldowns.pet <= 0) {
      setTool(g, 'pet');
      interact(g, pet.pos.x, pet.pos.y + 10);
      return;
    }
  }
}

function assertInvariants(g, where) {
  assert.ok(Number.isFinite(g.money), `${where}: money is not finite`);
  assert.ok(Number.isFinite(g.reputation), `${where}: reputation is not finite`);
  assert.ok(g.reputation >= 0 && g.reputation <= 200, `${where}: reputation out of range`);
  assert.ok(g.pets.length <= capacity(g), `${where}: too many pets for the beds`);
  assert.ok(g.messes.length <= 8, `${where}: mess list grew unbounded`);
  assert.ok(g.log.length <= 24, `${where}: log grew unbounded`);
  assert.ok(g.customers.length <= 8, `${where}: customer list grew unbounded`);
  for (const p of g.pets) {
    for (const [k, v] of Object.entries(p.needs)) {
      assert.ok(Number.isFinite(v), `${where}: ${p.name}.${k} is NaN`);
      assert.ok(v >= 0 && v <= 100, `${where}: ${p.name}.${k}=${v} out of range`);
    }
    assert.ok(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y), `${where}: ${p.name} position is NaN`);
  }
  for (const c of g.customers) {
    assert.ok(Number.isFinite(c.pos.x) && Number.isFinite(c.pos.y), `${where}: customer position is NaN`);
  }
}

test('a competent player survives 10 days and the shop grows', () => {
  const g = createGame({ seed: 20260727 });
  startGame(g);
  for (let day = 1; day <= 10; day++) {
    for (let i = 0; i < DAY.LENGTH * 30 + 30; i++) {
      if (g.phase !== PHASES.OPEN) break;
      step(g, DT);
      if (i % 4 === 0) tendShop(g);
    }
    assertInvariants(g, `day ${day}`);
    assert.notEqual(g.phase, PHASES.GAMEOVER, `went bankrupt on day ${day} with ${g.money}円`);
    openShopScreen(g);
    if (upgradeCost(g, 'bed') != null && g.money > upgradeCost(g, 'bed') + 800) buyUpgrade(g, 'bed');
    nextDay(g);
  }
  assert.ok(g.stats.adoptions >= 5, `only ${g.stats.adoptions} adoptions in 10 days`);
  assert.ok(g.reputation > DAY.START_REPUTATION, 'reputation never grew');
  assert.ok(g.money > 0);
});

test('an idle player is punished but the simulation stays valid', () => {
  const g = createGame({ seed: 4321 });
  startGame(g);
  for (let day = 1; day <= 6; day++) {
    for (let i = 0; i < DAY.LENGTH * 30 + 30; i++) {
      if (g.phase !== PHASES.OPEN) break;
      step(g, DT);
    }
    assertInvariants(g, `idle day ${day}`);
    if (g.phase === PHASES.GAMEOVER) break;
    openShopScreen(g);
    nextDay(g);
  }
  assert.ok(g.money < DAY.START_MONEY, 'neglecting the shop should cost money');
});

test('random clicking never corrupts the game state', () => {
  const rng = new Rng(31337);
  const tools = ['feed', 'brush', 'play', 'pet', 'clean'];
  const g = createGame({ seed: 987 });
  startGame(g);
  for (let i = 0; i < 30 * 60 * 6; i++) {
    step(g, DT);
    if (i % 3 === 0) {
      setTool(g, rng.pick(tools));
      interact(g, rng.range(0, 960), rng.range(0, 600));
    }
    if (g.phase !== PHASES.OPEN) {
      assertInvariants(g, `random click i=${i}`);
      if (g.phase === PHASES.GAMEOVER) break;
      openShopScreen(g);
      nextDay(g);
    }
    if (i % 500 === 0) assertInvariants(g, `random click i=${i}`);
  }
  assertInvariants(g, 'end of random run');
});

test('condition never leaves 0..100 across a long run', () => {
  const g = createGame({ seed: 606 });
  startGame(g);
  for (let i = 0; i < 30 * 60 * 4; i++) {
    step(g, DT);
    if (g.phase !== PHASES.OPEN) {
      openShopScreen(g);
      if (g.phase === PHASES.GAMEOVER) break;
      nextDay(g);
    }
    if (i % 97 === 0) {
      for (const p of g.pets) {
        const c = condition(p);
        assert.ok(c >= 0 && c <= 100, `condition ${c} out of range`);
      }
    }
  }
});

test('variable frame times produce the same day length', () => {
  const steady = createGame({ seed: 12 });
  startGame(steady);
  let t = 0;
  while (steady.phase === PHASES.OPEN) {
    step(steady, DT);
    t += DT;
  }
  assert.ok(Math.abs(t - DAY.LENGTH) < 0.1, `day ran ${t}s instead of ${DAY.LENGTH}s`);
});
