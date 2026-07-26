import test from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../../src/core/rng.js';

test('same seed produces the same sequence', () => {
  const a = new Rng(12345);
  const b = new Rng(12345);
  for (let i = 0; i < 200; i++) assert.equal(a.next(), b.next());
});

test('different seeds diverge', () => {
  const a = new Rng(1);
  const b = new Rng(2);
  const sa = Array.from({ length: 20 }, () => a.next());
  const sb = Array.from({ length: 20 }, () => b.next());
  assert.notDeepEqual(sa, sb);
});

test('next() stays inside [0,1)', () => {
  const r = new Rng(99);
  for (let i = 0; i < 5000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('int() is inclusive on both ends and never out of range', () => {
  const r = new Rng(7);
  const seen = new Set();
  for (let i = 0; i < 4000; i++) {
    const v = r.int(3, 6);
    assert.ok(Number.isInteger(v));
    assert.ok(v >= 3 && v <= 6, `int out of range: ${v}`);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [3, 4, 5, 6]);
});

test('pick() never returns undefined', () => {
  const r = new Rng(4242);
  const arr = ['a', 'b', 'c'];
  for (let i = 0; i < 2000; i++) assert.ok(arr.includes(r.pick(arr)));
});

test('serialize/deserialize resumes the exact stream', () => {
  const a = new Rng(2024);
  for (let i = 0; i < 37; i++) a.next();
  const b = Rng.deserialize(a.serialize());
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
});

test('seed 0 is normalised instead of getting stuck', () => {
  const r = new Rng(0);
  const first = r.next();
  const second = r.next();
  assert.notEqual(first, second);
});
