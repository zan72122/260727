import test from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../../src/core/rng.js';
import { createPet } from '../../src/game/pets.js';
import { createCustomer, matchScore, priceFor, bestMatch, updateCustomer, spawnInterval } from '../../src/game/customers.js';
import { CUSTOMER } from '../../src/game/balance.js';

function makePet(species, needs) {
  const p = createPet(new Rng(9), { day: 1, species });
  Object.assign(p.needs, needs);
  return p;
}

function makeCustomer(overrides = {}) {
  const c = createCustomer(new Rng(3), 1);
  return Object.assign(c, overrides);
}

test('a customer wanting dogs scores dogs above cats', () => {
  const c = makeCustomer({ wantSpecies: 'dog', wantPersonality: null });
  const needs = { hunger: 80, clean: 80, energy: 80, health: 90, affection: 50 };
  const dog = makePet('dog', needs);
  const cat = makePet('cat', needs);
  assert.ok(matchScore(c, dog, 100) > matchScore(c, cat, 100));
});

test('a matching personality adds to the score', () => {
  const needs = { hunger: 80, clean: 80, energy: 80, health: 90, affection: 50 };
  const pet = makePet('dog', needs);
  pet.personality = 'genki';
  const picky = makeCustomer({ wantSpecies: null, wantPersonality: 'genki' });
  const neutral = makeCustomer({ wantSpecies: null, wantPersonality: null });
  assert.ok(matchScore(picky, pet, 100) > matchScore(neutral, pet, 100));
});

test('sick pets are heavily penalised', () => {
  const c = makeCustomer({ wantSpecies: null, wantPersonality: null });
  const healthy = makePet('cat', { hunger: 80, clean: 80, energy: 80, health: 90, affection: 50 });
  const sick = makePet('cat', { hunger: 80, clean: 80, energy: 80, health: 20, affection: 50 });
  assert.ok(matchScore(c, healthy, 100) - matchScore(c, sick, 100) > 25);
});

test('price rises with condition and with affection', () => {
  const c = makeCustomer({ budget: 1 });
  const plain = makePet('dog', { hunger: 50, clean: 50, energy: 50, health: 50, affection: 20 });
  const great = makePet('dog', { hunger: 100, clean: 100, energy: 100, health: 100, affection: 20 });
  const loved = makePet('dog', { hunger: 50, clean: 50, energy: 50, health: 50, affection: 95 });
  assert.ok(priceFor(great, c, 20, 100) > priceFor(plain, c, 20, 100));
  assert.ok(priceFor(loved, c, 20, 100) > priceFor(plain, c, 20, 100));
});

test('price rises with shop reputation', () => {
  const c = makeCustomer({ budget: 1 });
  const pet = makePet('cat', { hunger: 80, clean: 80, energy: 80, health: 80, affection: 50 });
  assert.ok(priceFor(pet, c, 90, 100) > priceFor(pet, c, 10, 100));
});

test('price never goes below the floor', () => {
  const c = makeCustomer({ budget: 0.85 });
  const wreck = makePet('cat', { hunger: 0, clean: 0, energy: 0, health: 0, affection: 0 });
  assert.ok(priceFor(wreck, c, 0, 0) >= 120);
});

test('bestMatch ignores pets that are not adoptable yet', () => {
  const c = makeCustomer({ wantSpecies: null, wantPersonality: null });
  const neglected = makePet('dog', { hunger: 10, clean: 10, energy: 10, health: 30, affection: 2 });
  assert.equal(bestMatch(c, [neglected], 100), null);
});

test('bestMatch returns the strongest candidate above the threshold', () => {
  const c = makeCustomer({ wantSpecies: null, wantPersonality: null });
  const ok = makePet('dog', { hunger: 60, clean: 60, energy: 60, health: 70, affection: 40 });
  const best = makePet('cat', { hunger: 100, clean: 100, energy: 95, health: 100, affection: 90 });
  const match = bestMatch(c, [ok, best], 100);
  assert.ok(match);
  assert.equal(match.pet.id, best.id);
  assert.ok(match.score >= CUSTOMER.MATCH_THRESHOLD);
});

test('a customer whose patience runs out leaves and reports it', () => {
  const c = makeCustomer();
  const ctx = { rng: new Rng(2), pets: [], shopClean: 100 };
  let outcome = null;
  for (let i = 0; i < 4000 && !outcome; i++) outcome = updateCustomer(c, 1 / 30, ctx);
  assert.deepEqual(outcome, { type: 'leave' });
  assert.equal(c.result, 'left');
});

test('a customer eventually adopts a great pet', () => {
  const c = makeCustomer({ wantSpecies: null, wantPersonality: null });
  const pet = makePet('dog', { hunger: 100, clean: 100, energy: 100, health: 100, affection: 95 });
  const ctx = { rng: new Rng(2), pets: [pet], shopClean: 100 };
  let outcome = null;
  for (let i = 0; i < 2000 && !outcome; i++) outcome = updateCustomer(c, 1 / 30, ctx);
  assert.ok(outcome, 'customer never reached a decision');
  assert.equal(outcome.type, 'adopt');
  assert.equal(outcome.petId, pet.id);
});

test('a customer walks up to the pet before adopting it', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const c = createCustomer(new Rng(seed), 1);
    c.wantSpecies = null;
    c.wantPersonality = null;
    const pet = makePet('dog', { hunger: 100, clean: 100, energy: 100, health: 100, affection: 95 });
    pet.pos = { x: 200, y: 300 };
    const ctx = { rng: new Rng(seed), pets: [pet], shopClean: 100 };
    let outcome = null;
    for (let i = 0; i < 3000 && !outcome; i++) outcome = updateCustomer(c, 1 / 30, ctx);
    assert.ok(outcome && outcome.type === 'adopt', `seed ${seed}: no adoption`);
    const dist = Math.hypot(c.pos.x - pet.pos.x, c.pos.y - pet.pos.y);
    assert.ok(dist < 80, `seed ${seed}: adopted from ${Math.round(dist)}px away`);
  }
});

test('a customer chasing a wandering pet gives up waiting and adopts anyway', () => {
  const c = createCustomer(new Rng(7), 1);
  c.wantSpecies = null;
  c.wantPersonality = null;
  const pet = makePet('cat', { hunger: 100, clean: 100, energy: 100, health: 100, affection: 95 });
  const ctx = { rng: new Rng(7), pets: [pet], shopClean: 100 };
  let outcome = null;
  for (let i = 0; i < 3000 && !outcome; i++) {
    // The pet keeps teleporting away, so proximity alone would never be reached.
    pet.pos = { x: 120 + ((i * 37) % 700), y: 300 + ((i * 13) % 150) };
    outcome = updateCustomer(c, 1 / 30, ctx);
  }
  assert.ok(outcome, 'customer never resolved');
  assert.equal(outcome.type, 'adopt');
});

test('a customer whose chosen pet disappears goes back to browsing', () => {
  const c = makeCustomer({ wantSpecies: null, wantPersonality: null });
  c.state = 'approach';
  c.targetPetId = 9999;
  const outcome = updateCustomer(c, 1 / 30, { rng: new Rng(1), pets: [], shopClean: 100 });
  assert.equal(outcome, null);
  assert.equal(c.state, 'browse');
});

test('spawn interval shortens with reputation and stays within bounds', () => {
  const low = spawnInterval(0, {}, 100);
  const high = spawnInterval(140, {}, 100);
  assert.ok(high < low);
  for (const rep of [0, 20, 60, 100, 140, 500]) {
    for (const clean of [0, 50, 100]) {
      const v = spawnInterval(rep, { poster: 2 }, clean);
      assert.ok(v >= CUSTOMER.MIN_INTERVAL, `interval too small: ${v}`);
      assert.ok(v <= CUSTOMER.BASE_INTERVAL * 1.4, `interval too big: ${v}`);
    }
  }
});

test('the poster upgrade brings customers in faster', () => {
  assert.ok(spawnInterval(30, { poster: 2 }, 100) < spawnInterval(30, {}, 100));
});

test('a dirty shop slows customers down', () => {
  assert.ok(spawnInterval(30, {}, 10) > spawnInterval(30, {}, 100));
});
