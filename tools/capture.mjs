#!/usr/bin/env node
/**
 * QA capture harness.
 *
 *   node tools/capture.mjs --out shots/run1 [--shots a,b,c] [--width 1920] [--height 1080]
 *
 * Boots the dev server, loads the game headlessly, waits for `game:ready`, then
 * drives the debug camera through a set of named viewpoints and writes PNGs.
 * Also collects console errors / WebGL warnings and writes `report.json`.
 *
 * Named shots are defined in `SHOTS` below and are executed via `window.__QA__`
 * hooks that the game installs (see src/qa/DebugHooks.js).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1] ?? true]);
    return acc;
  }, [])
);

const OUT = resolve(ROOT, args.out || 'shots/latest');
const W = parseInt(args.width || '1920', 10);
const H = parseInt(args.height || '1080', 10);
const PORT = parseInt(args.port || '5199', 10);
const HOLD = parseInt(args.hold || '1400', 10); // ms to let TAA/anim settle

/** Camera viewpoints. Each entry: [name, position, lookAt, opts] */
const SHOTS = {
  overview:   { pos: [18, 9, 22],   look: [0, 1.6, 0],    fov: 60 },
  street:     { pos: [0, 1.7, 14],  look: [0, 1.7, -20],  fov: 82 },
  interior:   { pos: [-8, 1.7, -6], look: [6, 1.6, -10],  fov: 82 },
  weapon:     { pos: null,          look: null,           fov: 82, viewmodel: true },
  detail:     { pos: [3, 1.2, 3],   look: [3, 1.2, -2],   fov: 45 },
  skyline:    { pos: [0, 12, 30],   look: [0, 8, -40],    fov: 70 },
  combat:     { pos: null,          look: null,           fov: 82, viewmodel: true, enemies: true },
  lighting:   { pos: [-14, 3, -14], look: [10, 2, 10],    fov: 65 },
};

const wanted = args.shots && args.shots !== true
  ? String(args.shots).split(',').map((s) => s.trim()).filter((s) => SHOTS[s])
  : Object.keys(SHOTS);

mkdirSync(OUT, { recursive: true });

function startServer() {
  return new Promise((res, rej) => {
    const p = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' },
    });
    let done = false;
    const onData = (d) => {
      const s = d.toString();
      if (!done && /Local:|ready in/i.test(s)) { done = true; setTimeout(() => res(p), 400); }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('error', rej);
    setTimeout(() => { if (!done) { done = true; res(p); } }, 15000);
  });
}

const server = await startServer();
// The container ships a pinned Chromium build that may not match the npm
// playwright revision; point at it explicitly rather than downloading.
const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => existsSync(p));

const browser = await chromium.launch({
  executablePath: CHROME,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--disable-dev-shm-usage', '--no-sandbox',
  ],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const report = { shots: [], logs, ok: false, boot: null };

try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__GAME__ || window.__BOOT_ERROR__, null, { timeout: 90000 });

  const bootErr = await page.evaluate(() => window.__BOOT_ERROR__ || null);
  if (bootErr) { report.boot = bootErr; throw new Error('boot error: ' + bootErr); }
  report.boot = 'ok';

  // Let the first frames + async texture generation settle.
  await page.waitForTimeout(3000);

  for (const name of wanted) {
    const cfg = SHOTS[name];
    await page.evaluate(([n, c]) => window.__QA__?.setShot?.(n, c), [name, cfg]);
    await page.waitForTimeout(HOLD);
    const file = resolve(OUT, `${name}.png`);
    await page.screenshot({ path: file, type: 'png' });
    report.shots.push({ name, file });
  }

  const perf = await page.evaluate(() => ({
    fps: window.__GAME__?.engine?.clock?.fps ?? null,
    calls: window.__GAME__?.engine?.ctx?.renderer?.info?.render?.calls ?? null,
    tris: window.__GAME__?.engine?.ctx?.renderer?.info?.render?.triangles ?? null,
    texturesMB: window.__GAME__?.engine?.ctx?.renderer?.info?.memory ?? null,
  }));
  report.perf = perf;
  report.ok = logs.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]')).length === 0;
} catch (e) {
  report.error = String(e.message || e);
} finally {
  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  server.kill('SIGTERM');
}

console.log(JSON.stringify({ out: OUT, ok: report.ok, boot: report.boot, error: report.error,
  perf: report.perf, shots: report.shots.map((s) => s.name), logs: logs.slice(0, 25) }, null, 2));
process.exit(report.ok ? 0 : 1);
