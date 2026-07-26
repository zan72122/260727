import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, step, restock, PHASES } from '../../src/game/state.js';
import { saveGame, loadGame, hasSave, clearSave, SAVE_KEY } from '../../src/game/save.js';

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
}

function playedGame(seed = 55, seconds = 40) {
  const g = createGame({ seed });
  startGame(g);
  for (let i = 0; i < seconds * 30; i++) step(g, 1 / 30);
  return g;
}

test('save → load restores the shop exactly', () => {
  const storage = new MemoryStorage();
  const g = playedGame();
  g.money = 1234;
  g.reputation = 41;
  g.upgrades.bed = 2;
  assert.equal(saveGame(g, storage), true);
  assert.equal(hasSave(storage), true);

  const loaded = loadGame(storage);
  assert.ok(loaded);
  assert.equal(loaded.money, 1234);
  assert.equal(loaded.reputation, 41);
  assert.equal(loaded.day, g.day);
  assert.equal(loaded.upgrades.bed, 2);
  assert.equal(loaded.pets.length, g.pets.length);
  assert.deepEqual(loaded.pets.map((p) => p.name), g.pets.map((p) => p.name));
  assert.deepEqual(loaded.pets.map((p) => Math.round(p.needs.hunger)), g.pets.map((p) => Math.round(p.needs.hunger)));
});

test('a restored game keeps simulating deterministically', () => {
  const storage = new MemoryStorage();
  const g = playedGame(77);
  saveGame(g, storage);
  const loaded = loadGame(storage);
  for (let i = 0; i < 600; i++) {
    step(g, 1 / 30);
    step(loaded, 1 / 30);
  }
  assert.equal(Math.round(loaded.money), Math.round(g.money));
  assert.deepEqual(
    loaded.pets.map((p) => Math.round(p.needs.hunger)),
    g.pets.map((p) => Math.round(p.needs.hunger)),
  );
});

test('loading with no save returns null', () => {
  assert.equal(loadGame(new MemoryStorage()), null);
});

test('corrupt or foreign save data is rejected, not thrown', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, '{not json');
  assert.equal(loadGame(storage), null);
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 99, pets: [] }));
  assert.equal(loadGame(storage), null);
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 1 }));
  assert.equal(loadGame(storage), null);
});

test('a save that somehow lost every pet still loads a playable shop', () => {
  const storage = new MemoryStorage();
  const g = playedGame(21);
  g.pets.length = 0;
  saveGame(g, storage);
  const loaded = loadGame(storage);
  assert.ok(loaded);
  assert.ok(loaded.pets.length >= 1);
});

test('newly created pets after loading do not reuse existing ids', () => {
  const storage = new MemoryStorage();
  const g = playedGame(23);
  saveGame(g, storage);
  const loaded = loadGame(storage);
  loaded.money = 99999;
  const ids = new Set(loaded.pets.map((p) => p.id));
  loaded.phase = PHASES.SHOP;
  const res = restock(loaded);
  assert.equal(res.ok, true);
  assert.equal(ids.has(res.pet.id), false);
});

test('clearSave removes the slot', () => {
  const storage = new MemoryStorage();
  saveGame(playedGame(24), storage);
  clearSave(storage);
  assert.equal(hasSave(storage), false);
});

test('storage failures are swallowed rather than crashing the game', () => {
  const broken = {
    getItem() {
      throw new Error('nope');
    },
    setItem() {
      throw new Error('quota');
    },
    removeItem() {
      throw new Error('nope');
    },
  };
  assert.equal(saveGame(playedGame(25), broken), false);
  assert.equal(loadGame(broken), null);
  assert.equal(hasSave(broken), false);
  assert.doesNotThrow(() => clearSave(broken));
});

test('save works with no storage at all (private mode)', () => {
  assert.equal(saveGame(playedGame(26), null), false);
  assert.equal(loadGame(null), null);
});
