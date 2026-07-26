import test from 'node:test';
import assert from 'node:assert/strict';
import { Loop, SIM_DT } from '../../src/core/loop.js';
import { Particles } from '../../src/render/fx.js';

/** Drives requestAnimationFrame by hand so the loop can be tested without a browser. */
class FakeHost {
  constructor() {
    this.t = 0;
    this.queue = [];
    this.performance = { now: () => this.t };
  }
  requestAnimationFrame(fn) {
    this.queue.push(fn);
    return this.queue.length;
  }
  cancelAnimationFrame() {
    this.queue.length = 0;
  }
  advance(ms) {
    this.t += ms;
    const pending = this.queue;
    this.queue = [];
    for (const fn of pending) fn();
  }
}

test('the loop runs a fixed number of sim steps for a given elapsed time', () => {
  const host = new FakeHost();
  let steps = 0;
  let frames = 0;
  const loop = new Loop(() => steps++, () => frames++, host);
  loop.start();
  for (let i = 0; i < 60; i++) host.advance(1000 / 60); // 1 second at 60fps
  assert.equal(frames, 60);
  assert.ok(Math.abs(steps - 1 / SIM_DT) <= 1, `expected ~30 steps, got ${steps}`);
});

test('a long stall does not produce a catch-up avalanche', () => {
  const host = new FakeHost();
  let steps = 0;
  const loop = new Loop(() => steps++, () => {}, host);
  loop.start();
  host.advance(60_000); // tab was hidden for a minute
  assert.ok(steps <= 5, `spiral of death: ${steps} steps in one frame`);
});

test('pausing stops simulation but keeps rendering', () => {
  const host = new FakeHost();
  let steps = 0;
  let frames = 0;
  const loop = new Loop(() => steps++, () => frames++, host);
  loop.start();
  loop.setPaused(true);
  for (let i = 0; i < 30; i++) host.advance(16);
  assert.equal(steps, 0);
  assert.equal(frames, 30);
  loop.setPaused(false);
  for (let i = 0; i < 30; i++) host.advance(16);
  assert.ok(steps > 0);
});

test('unpausing does not fast-forward the simulation', () => {
  const host = new FakeHost();
  let steps = 0;
  const loop = new Loop(() => steps++, () => {}, host);
  loop.start();
  loop.setPaused(true);
  host.advance(10_000);
  loop.setPaused(false);
  host.advance(16);
  assert.ok(steps <= 1, `fast-forwarded ${steps} steps after unpause`);
});

test('speed 2x doubles the simulated time', () => {
  const host = new FakeHost();
  let steps = 0;
  const loop = new Loop(() => steps++, () => {}, host);
  loop.speed = 2;
  loop.start();
  for (let i = 0; i < 60; i++) host.advance(1000 / 60);
  assert.ok(steps > 45, `expected ~60 steps at 2x, got ${steps}`);
});

test('stop() halts everything', () => {
  const host = new FakeHost();
  let frames = 0;
  const loop = new Loop(() => {}, () => frames++, host);
  loop.start();
  host.advance(16);
  loop.stop();
  host.advance(16);
  assert.equal(frames, 1);
});

test('particle pool never grows and recycles slots', () => {
  const p = new Particles(20);
  for (let i = 0; i < 500; i++) p.spawn('heart', 10, 10, { life: 0.5 });
  assert.equal(p.items.length, 20);
  assert.ok(p.activeCount <= 20);
  for (let i = 0; i < 60; i++) p.update(1 / 30);
  assert.equal(p.activeCount, 0);
  assert.ok(p.spawn('heart', 0, 0, {}), 'pool should be reusable after particles expire');
});

test('particles move, fade and expire', () => {
  const p = new Particles(8);
  const particle = p.spawn('heart', 100, 100, { vx: 10, vy: -10, life: 0.5 });
  p.update(0.1);
  assert.ok(particle.x > 100);
  assert.ok(particle.y < 100);
  p.update(0.6);
  assert.equal(particle.alive, false);
  assert.equal(p.activeCount, 0);
});
