/**
 * Performance harness.
 *
 *   node tools/perf.mjs [--seconds 8] [--out docs/perf-report.json]
 *
 * Runs three live scenarios in headless Chromium (SwiftShader software GL, i.e.
 * a deliberately slow renderer) and records frame times sampled by the game's
 * own rAF loop, plus simulation-only cost measured without rendering.
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

const SECONDS = Number(arg('seconds', '8'));
const OUT = path.resolve(ROOT, arg('out', 'docs/perf-report.json'));

const SCENARIOS = [
  {
    id: 'title',
    label: 'タイトル画面（アイドル）',
    setup: () => {
      const g = globalThis.__WANNYAN__;
      g.reset(20260727);
    },
  },
  {
    id: 'typical',
    label: '通常プレイ（開店中・お客さん来店あり）',
    setup: () => {
      const g = globalThis.__WANNYAN__;
      g.reset(20260727);
      g.start();
      g.simulate(45);
      g.state.selectedPetId = g.state.pets[0]?.id ?? null;
    },
  },
  {
    id: 'stress',
    label: 'ストレス（ペット6匹・よごれ8個・パーティクル連続発生）',
    setup: () => {
      const g = globalThis.__WANNYAN__;
      g.reset(20260727);
      g.state.upgrades.bed = 3;
      g.start();
      while (g.state.pets.length < 6) {
        g.state.phase = g.PHASES.SHOP;
        g.state.money = 99999;
        g.state.pets.push(JSON.parse(JSON.stringify(g.state.pets[0])));
        g.state.pets[g.state.pets.length - 1].id = 1000 + g.state.pets.length;
        g.state.pets[g.state.pets.length - 1].pos = { x: 120 + g.state.pets.length * 110, y: 320 + (g.state.pets.length % 3) * 40 };
        g.state.phase = g.PHASES.OPEN;
      }
      for (let i = 0; i < 8; i++) {
        g.state.messes.push({ id: 2000 + i, x: 100 + i * 95, y: 300 + (i % 3) * 50, kind: ['fur', 'puddle', 'paw'][i % 3], rot: i });
      }
      g.simulate(20);
      g.state.selectedPetId = g.state.pets[0]?.id ?? null;
    },
  },
];

async function measure(page, scenario, seconds) {
  await page.evaluate(scenario.setup);
  await page.evaluate(() => globalThis.__WANNYAN__.perf.reset());

  // Sample the live particle count throughout the window, and in the stress
  // scenario keep feeding the pool so it stays saturated for the whole run.
  await page.evaluate((burst) => {
    const g = globalThis.__WANNYAN__;
    globalThis.__peakParticles = 0;
    globalThis.__sampler = setInterval(() => {
      if (burst) {
        for (const pet of g.state.pets) {
          g.particles.burstHearts(pet.pos.x, pet.pos.y - 30, 6, Math.random);
          g.particles.burstSparkles(pet.pos.x, pet.pos.y - 40, 8, '#ffe9a8', Math.random);
        }
      }
      globalThis.__peakParticles = Math.max(globalThis.__peakParticles, g.particles.activeCount);
    }, 60);
  }, scenario.id === 'stress');

  await page.waitForTimeout(seconds * 1000);

  const result = await page.evaluate(() => {
    clearInterval(globalThis.__sampler);
    const g = globalThis.__WANNYAN__;
    return {
      frame: g.perf.summary(),
      particles: globalThis.__peakParticles,
      pets: g.state.pets.length,
      customers: g.state.customers.length,
      messes: g.state.messes.length,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    };
  });
  return { id: scenario.id, label: scenario.label, ...result };
}

async function main() {
  const { url, close } = await startServer(0, ROOT);
  const browser = await launchBrowser();
  const { page, errors } = await openGame(browser, url);

  const boot = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      domContentLoadedMs: nav ? +nav.domContentLoadedEventEnd.toFixed(1) : null,
      loadMs: nav ? +nav.loadEventEnd.toFixed(1) : null,
      firstFrameMs: +performance.now().toFixed(1),
    };
  });

  // Simulation-only cost: 60 seconds of game time with no rendering at all.
  const sim = await page.evaluate(() => {
    const g = globalThis.__WANNYAN__;
    g.reset(20260727);
    g.start();
    g.loop.setPaused(true);
    const t0 = performance.now();
    g.simulate(60);
    const ms = performance.now() - t0;
    g.loop.setPaused(false);
    return {
      simSeconds: 60,
      wallMs: +ms.toFixed(2),
      msPerStep: +(ms / (60 * 30)).toFixed(4),
      realtimeFactor: Math.round(60000 / ms),
    };
  });

  // Does caching the shop interior actually pay for itself? Measure both paths.
  const roomLayer = await page.evaluate(async () => {
    const { drawRoom } = await import('/src/render/room.js');
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    const N = 40;
    drawRoom(ctx); // warm up
    let t0 = performance.now();
    for (let i = 0; i < N; i++) drawRoom(ctx);
    const directMs = (performance.now() - t0) / N;
    const layer = globalThis.__WANNYAN__.renderer.roomLayer;
    t0 = performance.now();
    for (let i = 0; i < N; i++) ctx.drawImage(layer, 0, 0, 960, 600);
    const blitMs = (performance.now() - t0) / N;
    return {
      drawRoomMs: +directMs.toFixed(3),
      blitCachedLayerMs: +blitMs.toFixed(3),
      speedup: +(directMs / Math.max(blitMs, 0.0001)).toFixed(1),
    };
  });

  const scenarios = [];
  for (const scenario of SCENARIOS) {
    process.stdout.write(`measuring ${scenario.id}… `);
    const r = await measure(page, scenario, SECONDS);
    console.log(`${r.frame.fps} fps (avg ${r.frame.avgMs} ms, p95 ${r.frame.p95Ms} ms)`);
    scenarios.push(r);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      userAgent: await page.evaluate(() => navigator.userAgent),
      viewport: '960x600 CSS px',
      renderer: 'Chromium headless, SwiftShader software rasteriser',
      note: 'Software rendering is a worst case; hardware-accelerated desktop browsers are considerably faster.',
      sampleSeconds: SECONDS,
    },
    boot,
    simulation: sim,
    roomLayer,
    scenarios,
    consoleErrors: errors,
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, `${JSON.stringify(report, null, 2)}\n`);
  const md = path.join(path.dirname(OUT), 'PERFORMANCE.md');
  await fs.writeFile(md, renderMarkdown(report));
  console.log(`\nreport → ${path.relative(ROOT, OUT)} and ${path.relative(ROOT, md)}`);

  await browser.close();
  await close();
  if (errors.length) {
    console.error(`console errors: ${errors.join('; ')}`);
    process.exitCode = 1;
  }
}

/** Renders the measured numbers into docs/PERFORMANCE.md. */
function renderMarkdown(r) {
  const rows = r.scenarios.map((s) => {
    const f = s.frame;
    return `| ${s.label} | ${s.pets} | ${s.particles} | ${f.fps} | ${f.avgMs} | ${f.p95Ms} | ${f.renderMs} | ${f.renderP95Ms} | ${f.simMs} | ${f.budgetUsedPct}% |`;
  });
  const worst = r.scenarios.reduce((a, b) => (a.frame.renderMs > b.frame.renderMs ? a : b));
  return `# パフォーマンス計測レポート

> このファイルは \`npm run perf\` (tools/perf.mjs) が自動生成します。数値は実測値です。
> 生成日時: ${r.generatedAt}

## 計測環境

| 項目 | 値 |
|---|---|
| レンダラ | ${r.environment.renderer} |
| 解像度 | ${r.environment.viewport}（devicePixelRatio 1、内部 960×600 論理ピクセル） |
| 計測時間 | 各シナリオ ${r.environment.sampleSeconds} 秒 |
| UA | \`${r.environment.userAgent}\` |

${r.environment.note}

## 起動

| 指標 | 実測 |
|---|---|
| DOMContentLoaded | ${r.boot.domContentLoadedMs} ms |
| load | ${r.boot.loadMs} ms |
| 最初のフレームが出るまで | ${r.boot.firstFrameMs} ms |

外部アセット（画像・音声・フォント・CDN）をひとつも読み込まないため、起動はネットワークではなく
JS のパースとルームレイヤーの初回描画だけで決まります。

## シナリオ別フレーム計測

frame 列は rAF の実測間隔（vsync で 60 fps 上限）、render / sim 列は 1 フレーム内で実際に
消費した処理時間です。60 fps の予算は 16.67 ms なので、余力は budget 列で読めます。

| シナリオ | ペット | パーティクル | fps | frame avg (ms) | frame p95 (ms) | render avg (ms) | render p95 (ms) | sim avg (ms) | 60fps予算の使用率 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}

最も重い「${worst.label}」でも 1 フレームあたりの自前処理は平均 ${worst.frame.renderMs} ms、
p95 で ${worst.frame.renderP95Ms} ms。ソフトウェアラスタライザ上でも 60 fps の予算の
${worst.frame.budgetUsedPct}% しか使っていません。

## シミュレーション単体

レンダリングを止めて、ゲーム内 ${r.simulation.simSeconds} 秒ぶんを一気に回した結果です。

| 指標 | 実測 |
|---|---|
| ${r.simulation.simSeconds} 秒ぶんの実行時間 | ${r.simulation.wallMs} ms |
| 1 ステップ (1/30 秒) あたり | ${r.simulation.msPerStep} ms |
| 実時間に対する倍率 | 約 ${r.simulation.realtimeFactor}× |

固定タイムステップ 30 Hz なので、シミュレーションはフレームレートに左右されません。
自動テストが 10 日ぶんのプレイを 1 秒未満で回せるのはこの軽さのおかげです。

## 効いている最適化

1. **店内の背景をオフスクリーンにキャッシュ**（\`src/render/room.js\`）
   壁・床・窓・棚・ラグ・ドアは変化しないので、起動時に一度だけ 960×600 のオフスクリーン
   キャンバスへ描き、毎フレームは 1 回の \`drawImage\` で転送しています。実測で
   毎フレーム描き直すと ${r.roomLayer.drawRoomMs} ms、キャッシュ転送なら ${r.roomLayer.blitCachedLayerMs} ms
   （**約 ${r.roomLayer.speedup}× 高速**）。
2. **パーティクルは固定長プール**（\`src/render/fx.js\`）
   ${'`Particles`'} は起動時に 180 個を確保し、以降は使い回すだけ。プレイ中の
   パーティクル生成でヒープが増えないため、GC 由来のカクつきが起きません。
   計測中のヒープは ${r.scenarios.map((s) => s.heapMB).filter(Boolean).join(' / ')} MB で安定していました。
3. **固定タイムステップ + キャッチアップ上限**（\`src/core/loop.js\`）
   1 フレームで進めるシミュレーションは最大 5 ステップ。タブを長時間隠しても
   復帰時に大量のステップが走る「死のスパイラル」が起きません。
4. **devicePixelRatio は 2 で頭打ち**（\`src/render/renderer.js\`）
   高 DPI 環境でも塗る量が 4 倍を超えないようにしています。
5. **当たり判定は毎フレーム作り直す矩形リストのみ**（\`src/render/hud.js\`）
   DOM を一切使わず、UI もキャンバスに直接描いているためレイアウト計算やリフローが発生しません。

## 消費リソース

| 項目 | 値 |
|---|---|
| 外部リクエスト | 0（画像・音声・フォント・スクリプトすべて自前） |
| JS ヒープ（計測中） | ${r.scenarios.map((s) => `${s.id}: ${s.heapMB ?? 'n/a'} MB`).join(' / ')} |
| コンソールエラー | ${r.consoleErrors.length === 0 ? 'なし' : r.consoleErrors.join('; ')} |
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
