#!/usr/bin/env node
// tools/loop.mjs — runs the sealed loop twice on T, the tune half only (rows before the split; V is never handed over):
// the adaptive loop and its twin with frozen weights. Writes data/run-adaptive.json + data/cell-adaptive.txt and
// data/run-fixed.json + data/cell-fixed.txt. `--check` re-runs both and fails unless all four files reproduce byte
// for byte: CI runs that on every push.
import { readFileSync, writeFileSync } from 'node:fs';
import S from '../src/semeion.mjs';
import L from '../src/loop.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const check = process.argv.includes('--check');
const { T } = S.halves(S.parse(read('data/semeion.data')));
const s0 = read('vendor/settling-cell/data/cell.txt');
let same = true;
for (const [tag, adaptive] of [['adaptive', true], ['fixed', false]]) {
  const t0 = Date.now();
  const r = L.runLoop(T, s0, { adaptive });
  if (!r) { console.error('loop: the starting cell did not load'); process.exit(1); }
  const run = JSON.stringify({ adaptive, cycles: r.log.length, tune: T.x.length, ops: L.OPS, weights: r.weights, hash: r.hash, accepted: r.log.filter((e) => e[2]).length, log: r.log }) + '\n';
  if (check) {
    const ok = read('data/run-' + tag + '.json') === run && read('data/cell-' + tag + '.txt') === r.text;
    same = same && ok;
    console.log(tag + ': ' + (ok ? 'LOOP REPRODUCED · ' + r.hash.slice(0, 16) : 'LOOP DIFFERS'));
    continue;
  }
  writeFileSync(new URL('data/run-' + tag + '.json', ROOT), run);
  writeFileSync(new URL('data/cell-' + tag + '.txt', ROOT), r.text);
  console.log(tag + ': ' + r.log.length + ' cycles in ' + Math.round((Date.now() - t0) / 1000) + ' s · ' + r.log.filter((e) => e[2]).length + ' accepted · weights ' + r.weights.join(',') + ' · ' + r.hash);
}
if (check) process.exit(same ? 0 : 1);
