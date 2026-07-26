/**
 * End-to-end tests: the real game running in headless Chromium, driven through
 * real mouse and keyboard input wherever the input plumbing is what's under test.
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../tools/serve.mjs';
import { launchBrowser, openGame } from '../../tools/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let server;
let browser;
let page;
let errors;

before(async () => {
  server = await startServer(0, ROOT);
  browser = await launchBrowser();
  ({ page, errors } = await openGame(browser, server.url));
});

after(async () => {
  await browser?.close();
  await server?.close();
});

beforeEach(async () => {
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.reset(20260727);
    g.ui.paused = false;
    g.loop.setPaused(false);
    g.setSpeed(1);
  });
});

const getState = (fn) => page.evaluate(fn);

/**
 * Clicks a UI element by its region id with a real mouse event. Region rects are
 * rebuilt every frame by the renderer, so this also proves the hit-testing works.
 */
async function clickRegion(id) {
  // The region list is rebuilt during render, so wait for the next frame that
  // actually contains the control before aiming at it.
  await page.waitForFunction(
    (wanted) => globalThis.__WANNYAN__.renderer.regions.list.some((x) => x.id === wanted),
    id,
    { timeout: 5000 },
  ).catch(() => {});
  const rect = await page.evaluate((wanted) => {
    const r = globalThis.__WANNYAN__.renderer.regions.list.find((x) => x.id === wanted);
    return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
  }, id);
  assert.ok(rect, `no UI region called "${id}" is on screen`);
  await page.mouse.click(rect.x, rect.y);
  await page.waitForTimeout(30);
}

test('the page boots, exposes the game and paints a non-blank canvas', async () => {
  const info = await getState(() => {
    const g = globalThis.__WANNYAN__;
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colours = new Set();
    for (let i = 0; i < data.length; i += 4 * 997) {
      colours.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    }
    return {
      version: g.version,
      phase: g.state.phase,
      canvasW: canvas.width,
      canvasH: canvas.height,
      distinctColours: colours.size,
      bootRemoved: document.getElementById('boot') === null,
    };
  });
  assert.equal(info.version, '1.0.0');
  assert.equal(info.phase, 'title');
  assert.equal(info.canvasW, 960);
  assert.equal(info.canvasH, 600);
  assert.ok(info.distinctColours > 12, `canvas looks blank (${info.distinctColours} colours)`);
  assert.equal(info.bootRemoved, true);
  assert.deepEqual(errors, []);
});

test('clicking はじめから on the title screen opens the shop', async () => {
  await clickRegion('btn:start');
  const phase = await getState(() => globalThis.__WANNYAN__.state.phase);
  assert.equal(phase, 'open');
});

test('toolbar buttons and number keys both switch tools', async () => {
  await page.evaluate(() => globalThis.__WANNYAN__.start());
  await clickRegion('tool:clean');
  assert.equal(await getState(() => globalThis.__WANNYAN__.state.tool), 'clean');
  await page.keyboard.press('1');
  assert.equal(await getState(() => globalThis.__WANNYAN__.state.tool), 'feed');
  await page.keyboard.press('3');
  assert.equal(await getState(() => globalThis.__WANNYAN__.state.tool), 'play');
});

test('feeding a pet with a real mouse click costs money and fills its belly', async () => {
  const target = await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.start();
    const pet = g.state.pets[0];
    pet.needs.hunger = 30;
    pet.state = 'idle';
    g.setTool('feed');
    return { x: Math.round(pet.pos.x), y: Math.round(pet.pos.y), money: g.state.money, id: pet.id };
  });
  await page.mouse.click(target.x, target.y);
  const after = await page.evaluate((id) => {
    const g = globalThis.__WANNYAN__;
    const pet = g.state.pets.find((p) => p.id === id);
    return { hunger: pet.needs.hunger, money: g.state.money, selected: g.state.selectedPetId };
  }, target.id);
  assert.ok(after.hunger > 30, 'pet was not fed');
  assert.equal(after.money, target.money - 40);
  assert.equal(after.selected, target.id);
});

test('the cleaning tool removes a mess where the player clicks', async () => {
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.start();
    g.setTool('clean');
    g.state.messes.length = 0;
    g.state.messes.push({ id: 4242, x: 480, y: 430, kind: 'fur', rot: 0 });
  });
  await page.mouse.click(480, 430);
  const messes = await getState(() => globalThis.__WANNYAN__.state.messes.length);
  assert.equal(messes, 0);
});

test('Esc pauses the simulation and the clock stops', async () => {
  await page.evaluate(() => globalThis.__WANNYAN__.start());
  await page.keyboard.press('Escape');
  const paused = await getState(() => globalThis.__WANNYAN__.ui.paused);
  assert.equal(paused, true);
  const before = await getState(() => globalThis.__WANNYAN__.state.timeInDay);
  await page.waitForTimeout(600);
  const afterPause = await getState(() => globalThis.__WANNYAN__.state.timeInDay);
  assert.equal(afterPause, before, 'the day clock advanced while paused');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const resumed = await getState(() => globalThis.__WANNYAN__.state.timeInDay);
  assert.ok(resumed > before, 'the day clock did not resume');
});

test('the loop actually advances the game in real time', async () => {
  await page.evaluate(() => globalThis.__WANNYAN__.start());
  const before = await getState(() => globalThis.__WANNYAN__.state.timeInDay);
  await page.waitForTimeout(700);
  const after = await getState(() => globalThis.__WANNYAN__.state.timeInDay);
  assert.ok(after - before > 0.3, `only advanced ${after - before}s in 0.7s`);
  assert.ok(after - before < 1.2, `advanced too fast: ${after - before}s`);
});

test('a full day can be finished with real clicks: report → shop → next day', async () => {
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.start();
    g.endDay();
  });
  assert.equal(await getState(() => globalThis.__WANNYAN__.state.phase), 'report');
  await clickRegion('btn:toshop');
  assert.equal(await getState(() => globalThis.__WANNYAN__.state.phase), 'shop');
  await clickRegion('btn:open');
  const after = await getState(() => ({
    phase: globalThis.__WANNYAN__.state.phase,
    day: globalThis.__WANNYAN__.state.day,
  }));
  assert.equal(after.phase, 'open');
  assert.equal(after.day, 2);
});

test('an upgrade can be bought from the shop screen', async () => {
  const before = await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.start();
    g.state.money = 5000;
    g.state.phase = g.PHASES.SHOP;
    return { money: g.state.money, beds: g.state.upgrades.bed };
  });
  await clickRegion('btn:buy:bed');
  const after = await getState(() => ({
    money: globalThis.__WANNYAN__.state.money,
    beds: globalThis.__WANNYAN__.state.upgrades.bed,
  }));
  assert.equal(after.beds, before.beds + 1);
  assert.equal(after.money, before.money - 900);
});

test('progress survives a reload through つづきから', async () => {
  const saved = await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.start();
    g.simulate(20);
    g.state.money = 4321;
    g.state.day = 4;
    return { ok: g.state.pets.map((p) => p.name), money: 4321, day: 4 };
  });
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.ui.paused = false;
    g.state.phase = g.PHASES.OPEN;
  });
  // The pause button autosaves.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(globalThis.__WANNYAN__));
  await page.evaluate(() => globalThis.__WANNYAN__.setMuted(true));
  await clickRegion('btn:continue');
  const restored = await getState(() => ({
    money: globalThis.__WANNYAN__.state.money,
    day: globalThis.__WANNYAN__.state.day,
    names: globalThis.__WANNYAN__.state.pets.map((p) => p.name),
    phase: globalThis.__WANNYAN__.state.phase,
  }));
  assert.equal(restored.money, saved.money);
  assert.equal(restored.day, saved.day);
  assert.deepEqual(restored.names, saved.ok);
  assert.equal(restored.phase, 'open');
});

test('the particle pool never exceeds its capacity under spam', async () => {
  const peak = await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.start();
    let max = 0;
    for (let i = 0; i < 400; i++) {
      g.particles.burstHearts(400, 400, 8, Math.random);
      g.particles.burstSparkles(500, 400, 8, '#fff', Math.random);
      g.particles.update(1 / 30);
      max = Math.max(max, g.particles.activeCount);
    }
    return max;
  });
  assert.ok(peak <= 180, `particle pool grew to ${peak}`);
});

test('resizing the window keeps rendering without errors', async () => {
  await page.setViewportSize({ width: 640, height: 400 });
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  const ok = await getState(() => {
    const g = globalThis.__WANNYAN__;
    return g.perf.summary().samples > 0 && g.state.phase !== undefined;
  });
  assert.equal(ok, true);
  await page.setViewportSize({ width: 960, height: 600 });
  await page.waitForTimeout(100);
});

test('a real playthrough of one in-game day produces no console errors', async () => {
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.reset(4242);
    g.start();
    g.setSpeed(2);
  });
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => {
      const g = globalThis.__WANNYAN__;
      const tools = ['feed', 'brush', 'play', 'pet', 'clean'];
      g.setTool(tools[Math.floor(Math.random() * tools.length)]);
      const pet = g.state.pets[0];
      if (pet) g.click(pet.pos.x, pet.pos.y);
      g.simulate(12);
    });
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => globalThis.__WANNYAN__.setSpeed(1));
  assert.deepEqual(errors, []);
});
