import test from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../../src/core/rng.js';
import { createPet, updatePet, applyCare, condition, urgentNeed, isAdoptable, moodOf } from '../../src/game/pets.js';
import { ACTIONS, NEEDS } from '../../src/game/balance.js';

const ctx = () => ({ rng: new Rng(11), upgrades: {} });

function pet(overrides = {}) {
  const p = createPet(new Rng(5), { day: 1 });
  Object.assign(p.needs, overrides);
  return p;
}

test('a new pet starts with sane, in-range needs', () => {
  const rng = new Rng(31);
  for (let i = 0; i < 60; i++) {
    const p = createPet(rng, { day: 1 });
    for (const [k, v] of Object.entries(p.needs)) {
      assert.ok(v >= 0 && v <= 100, `${k}=${v} out of range`);
    }
    assert.ok(['dog', 'cat'].includes(p.species));
    assert.ok(p.name.length > 0);
    assert.ok(p.breedName.length > 0);
  }
});

test('needs decay over time and never leave 0..100', () => {
  const p = pet({ hunger: 50, clean: 50, energy: 50, affection: 50, health: 80 });
  const before = { ...p.needs };
  const c = ctx();
  for (let i = 0; i < 30; i++) updatePet(p, 1 / 30, c);
  assert.ok(p.needs.hunger < before.hunger);
  assert.ok(p.needs.clean < before.clean);
  for (const v of Object.values(p.needs)) assert.ok(v >= 0 && v <= 100);
});

test('hunger decay matches the balance table', () => {
  const p = pet({ hunger: 90, energy: 90 });
  p.state = 'idle';
  const c = ctx();
  for (let i = 0; i < 30; i++) updatePet(p, 1 / 30, c);
  const expected = 90 - NEEDS.HUNGER_DECAY;
  assert.ok(Math.abs(p.needs.hunger - expected) < 0.001, `${p.needs.hunger} vs ${expected}`);
});

test('高級フード upgrade slows hunger decay', () => {
  const plain = pet({ hunger: 90 });
  const upgraded = pet({ hunger: 90 });
  const c1 = { rng: new Rng(3), upgrades: {} };
  const c2 = { rng: new Rng(3), upgrades: { food: 2 } };
  for (let i = 0; i < 60; i++) {
    updatePet(plain, 1 / 30, c1);
    updatePet(upgraded, 1 / 30, c2);
  }
  assert.ok(upgraded.needs.hunger > plain.needs.hunger);
});

test('feeding raises hunger, costs money and sets a cooldown', () => {
  const p = pet({ hunger: 30 });
  const res = applyCare(p, 'feed', { money: 1000 });
  assert.equal(res.ok, true);
  assert.equal(res.cost, ACTIONS.feed.cost);
  assert.ok(p.needs.hunger > 30);
  assert.ok(p.cooldowns.feed > 0);

  const second = applyCare(p, 'feed', { money: 1000 });
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'cooldown');
});

test('a full pet refuses food (and is not charged)', () => {
  const p = pet({ hunger: 95 });
  const res = applyCare(p, 'feed', { money: 1000 });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'full');
  assert.equal(res.cost, 0);
});

test('feeding without enough money fails', () => {
  const p = pet({ hunger: 20 });
  const res = applyCare(p, 'feed', { money: 5 });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'money');
  assert.equal(p.needs.hunger, 20);
});

test('brushing raises cleanliness and affection', () => {
  const p = pet({ clean: 20, affection: 10 });
  const res = applyCare(p, 'brush', {});
  assert.equal(res.ok, true);
  assert.ok(p.needs.clean > 20);
  assert.ok(p.needs.affection > 10);
});

test('playing is refused when the pet is exhausted', () => {
  const p = pet({ energy: 10 });
  const res = applyCare(p, 'play', {});
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'tired');
});

test('petting a sleeping pet is gentle rather than refused', () => {
  const p = pet({ affection: 40 });
  p.state = 'sleep';
  const res = applyCare(p, 'pet', {});
  assert.equal(res.ok, true);
  assert.equal(res.gentle, true);
});

test('petting a sleeping pet still takes a cooldown (no click-spam bonding)', () => {
  const p = pet({ affection: 10 });
  p.state = 'sleep';
  const first = applyCare(p, 'pet', {});
  assert.equal(first.ok, true);
  assert.ok(p.cooldowns.pet > 0, 'a gentle stroke must arm the cooldown too');
  const spam = applyCare(p, 'pet', {});
  assert.equal(spam.ok, false);
  assert.equal(spam.reason, 'cooldown');
  assert.ok(p.needs.affection < 13, `affection ran away: ${p.needs.affection}`);
});

test('200 clicks in one frame cannot max a sleeping pet out', () => {
  const p = pet({ affection: 0 });
  p.state = 'sleep';
  let accepted = 0;
  for (let i = 0; i < 200; i++) if (applyCare(p, 'pet', {}).ok) accepted++;
  assert.equal(accepted, 1);
  assert.ok(p.needs.affection <= 2, `affection reached ${p.needs.affection}`);
});

test('personality changes how much affection an action gives', () => {
  const shy = pet({ affection: 10 });
  shy.personality = 'shy';
  const clingy = pet({ affection: 10 });
  clingy.personality = 'amae';
  applyCare(shy, 'pet', {});
  applyCare(clingy, 'pet', {});
  assert.ok(clingy.needs.affection > shy.needs.affection);
});

test('neglect drains health, care restores it', () => {
  const starving = pet({ hunger: 5, clean: 5, health: 60 });
  const cared = pet({ hunger: 90, clean: 90, health: 60 });
  const c = ctx();
  for (let i = 0; i < 60; i++) {
    updatePet(starving, 1 / 30, c);
    updatePet(cared, 1 / 30, c);
  }
  assert.ok(starving.needs.health < 60);
  assert.ok(cared.needs.health > 60);
});

test('condition() is bounded and responds to needs', () => {
  const good = pet({ hunger: 100, clean: 100, energy: 100, health: 100 });
  const bad = pet({ hunger: 0, clean: 0, energy: 0, health: 0 });
  assert.equal(Math.round(condition(good)), 100);
  assert.equal(Math.round(condition(bad)), 0);
});

test('urgentNeed() surfaces the lowest need only when it matters', () => {
  const fine = pet({ hunger: 90, clean: 90, energy: 90, affection: 90, health: 90 });
  assert.equal(urgentNeed(fine), null);
  const hungry = pet({ hunger: 10, clean: 90, energy: 90, affection: 90, health: 90 });
  assert.equal(urgentNeed(hungry).id, 'hunger');
});

test('a well-cared-for pet becomes adoptable', () => {
  const p = pet({ hunger: 80, clean: 80, energy: 80, health: 90, affection: 40 });
  assert.equal(isAdoptable(p), true);
  const neglected = pet({ hunger: 20, clean: 20, energy: 20, health: 20, affection: 5 });
  assert.equal(isAdoptable(neglected), false);
});

test('exhausted pets fall asleep and recover energy', () => {
  const p = pet({ energy: 5 });
  const c = ctx();
  updatePet(p, 1 / 30, c);
  assert.equal(p.state, 'sleep');
  for (let i = 0; i < 300; i++) updatePet(p, 1 / 30, c);
  assert.ok(p.needs.energy > 5);
});

test('mood labels cover the whole condition range', () => {
  assert.equal(moodOf(pet({ health: 10 })).id, 'sick');
  assert.equal(moodOf(pet({ health: 90, hunger: 10 })).id, 'hungry');
  assert.equal(moodOf(pet({ health: 95, hunger: 95, clean: 95, energy: 95, affection: 80 })).id, 'love');
});

test('pets stay inside the play area while wandering', () => {
  const p = pet({ energy: 100 });
  const c = ctx();
  for (let i = 0; i < 4000; i++) {
    updatePet(p, 1 / 30, c);
    assert.ok(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y));
    assert.ok(p.pos.x > 0 && p.pos.x < 960);
    assert.ok(p.pos.y > 200 && p.pos.y < 520);
  }
});
