#!/usr/bin/env node
/**
 * Blind A/B comparison harness.
 *
 *   node tools/blind-compare.mjs --ours shots/final --refs refs/ --out shots/compare
 *
 * Pairs each of our screenshots with a reference screenshot, randomly assigns
 * each to slot A or slot B, and writes the pair plus a `key.json` that maps slot
 * -> source. The critic agent is shown ONLY the images and must pick a winner
 * per pair without seeing the key; the key is revealed afterwards to score.
 *
 * Reference images are read from disk and never committed (see .gitignore).
 */
import { readdirSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1] ?? true]);
    return acc;
  }, [])
);

const OURS = resolve(ROOT, args.ours || 'shots/final');
const REFS = resolve(ROOT, args.refs || 'refs');
const OUT  = resolve(ROOT, args.out  || 'shots/compare');
const SEED = parseInt(args.seed || '20260726', 10);

// Deterministic shuffle so a run can be reproduced and audited.
let s = SEED >>> 0;
const rng = () => ((s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6D2B79F5) >>> 0) / 4294967296);

const png = (d) => existsSync(d) ? readdirSync(d).filter((f) => extname(f).toLowerCase() === '.png') : [];

const ours = png(OURS);
const refs = png(REFS);

if (!ours.length) { console.error(`No screenshots in ${OURS}`); process.exit(1); }
if (!refs.length) { console.error(`No reference images in ${REFS} — populate it first.`); process.exit(1); }

mkdirSync(OUT, { recursive: true });

const key = [];
const n = Math.min(ours.length, refs.length);
for (let i = 0; i < n; i++) {
  const ourFile = resolve(OURS, ours[i]);
  const refFile = resolve(REFS, refs[i % refs.length]);
  const oursIsA = rng() < 0.5;
  const aSrc = oursIsA ? ourFile : refFile;
  const bSrc = oursIsA ? refFile : ourFile;
  const pair = `pair${String(i + 1).padStart(2, '0')}`;
  copyFileSync(aSrc, resolve(OUT, `${pair}_A.png`));
  copyFileSync(bSrc, resolve(OUT, `${pair}_B.png`));
  key.push({ pair, A: oursIsA ? 'ours' : 'reference', B: oursIsA ? 'reference' : 'ours',
             oursFile: basename(ourFile), refFile: basename(refFile) });
}

writeFileSync(resolve(OUT, 'key.json'), JSON.stringify({ seed: SEED, pairs: key }, null, 2));
console.log(JSON.stringify({ out: OUT, pairs: key.length,
  note: 'key.json holds the answer — do not show it to the critic before they judge.' }, null, 2));
