/**
 * Headless screenshot harness.
 *
 *   node tools/capture.mjs [--out screenshots] [--scale 2]
 *
 * Boots the game in Chromium, drives it through every screen with the QA hooks
 * and writes PNGs plus a small JSON report (console errors, timings).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { launchBrowser, openGame } from './browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OUT = path.resolve(ROOT, arg('out', 'screenshots'));
const SCALE = Number(arg('scale', '2'));
const SEED = Number(arg('seed', '20260727'));

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const { url, close } = await startServer(0, ROOT);
  const browser = await launchBrowser();
  const { page, errors } = await openGame(browser, url, { deviceScaleFactor: SCALE });
  const shots = [];

  const shot = async (name, note) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, animations: 'disabled' });
    const { size } = await fs.stat(file);
    shots.push({ name, note, file: path.relative(ROOT, file), bytes: size });
    console.log(`  ✓ ${name}.png (${(size / 1024).toFixed(0)} KB) — ${note}`);
  };

  console.log('capturing screens…');

  // 1. Title
  await page.evaluate((seed) => {
    const g = globalThis.__WANNYAN__;
    g.reset(seed);
  }, SEED);
  await page.waitForTimeout(120);
  await shot('01-title', 'タイトル画面');

  // 2. Opening day — pets settled in, a pet selected, care in progress
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.start();
    g.simulate(18);
    const s = g.state;
    s.selectedPetId = s.pets[0]?.id ?? null;
    s.tool = 'brush';
  });
  await page.waitForTimeout(120);
  await shot('02-shop-open', '開店直後：ペットとHUD');

  // 3. Mid-day with a customer, messes and particles
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.simulate(46);
    const s = g.state;
    s.tool = 'pet';
    for (const pet of s.pets) {
      g.particles.burstHearts(pet.pos.x, pet.pos.y - 30, 3, Math.random);
    }
    s.selectedPetId = s.pets[0]?.id ?? null;
  });
  await page.waitForTimeout(120);
  await shot('03-care', 'お世話中：お客さん・よごれ・ハート');

  // 4. Dirty shop warning + cleaning tool
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    const s = g.state;
    s.tool = 'clean';
    for (let i = 0; i < 7; i++) {
      s.messes.push({
        id: 1000 + i,
        x: 120 + i * 100,
        y: 300 + (i % 3) * 50,
        kind: ['fur', 'puddle', 'paw'][i % 3],
        rot: i,
      });
    }
    g.simulate(1);
  });
  await page.waitForTimeout(120);
  await shot('04-cleaning', 'おそうじ：店内よごれ警告');

  // 5. Day report
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.state.messes.length = 0;
    g.endDay();
  });
  await page.waitForTimeout(120);
  await shot('05-report', '一日のせいさん');

  // 6. Upgrade screen
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.state.money = 4200;
    g.state.phase = g.PHASES.SHOP;
  });
  await page.waitForTimeout(120);
  await shot('06-upgrades', 'お店のじゅんび（アップグレード）');

  // 7. Ending
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    const s = g.state;
    s.stats.adoptions = 18;
    s.stats.earned = 24800;
    s.stats.careActions = 412;
    s.day = 11;
    s.reputation = 104;
    s.phase = g.PHASES.ENDING;
  });
  await page.waitForTimeout(120);
  await shot('07-ending', 'エンディング');

  // 8. Pause overlay back in play
  await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.state.phase = g.PHASES.OPEN;
    g.ui.paused = true;
  });
  await page.waitForTimeout(120);
  await shot('08-pause', 'ポーズ画面');

  const report = {
    generatedAt: new Date().toISOString(),
    seed: SEED,
    deviceScaleFactor: SCALE,
    shots,
    consoleErrors: errors,
  };
  await fs.writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

  await browser.close();
  await close();

  if (errors.length) {
    console.error(`\n${errors.length} console error(s):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exitCode = 1;
  } else {
    console.log(`\n${shots.length} screenshots written to ${path.relative(ROOT, OUT)}/ with no console errors.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
