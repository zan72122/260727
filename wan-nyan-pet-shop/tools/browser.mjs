/**
 * Shared Chromium bootstrap for the automated visual/e2e/perf tooling.
 * Playwright is resolved from the repository root node_modules.
 */
import fs from 'node:fs';

const CANDIDATE_BROWSERS = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean);

export function findChromium() {
  for (const p of CANDIDATE_BROWSERS) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function launchBrowser() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('playwright is not installed — run `npm install playwright` at the repository root');
  }
  const executablePath = findChromium();
  return chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--hide-scrollbars'],
  });
}

/**
 * Opens the game, waits for the QA hook, and collects console/page errors.
 * @returns {Promise<{page:object, errors:string[], context:object}>}
 */
export async function openGame(browser, url, { width = 960, height = 600, deviceScaleFactor = 1 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor,
    reducedMotion: 'no-preference',
  });
  const errors = [];
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(globalThis.__WANNYAN__), null, { timeout: 15000 });
  await page.evaluate(() => globalThis.__WANNYAN__.setMuted(true));
  return { page, errors, context };
}
