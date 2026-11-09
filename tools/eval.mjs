#!/usr/bin/env node
// tools/eval.mjs — the blind half V, read once. It refuses to run unless SEAL2.md names both final cells by their
// SHA-256 and the Semeion file is the one seal 1 pinned. Writes data/record.json. `--check` re-runs and fails unless the
// record reproduces exactly: CI runs that on every push, and the page's worker reproduces the same hash in a tab.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import E from '../src/eval.mjs';

export const SEMEION_SHA256 = 'f43228ae3da5ea6a3c95069d53450b86166770e3b719dcc333182128fe08d4b1';
const ROOT = new URL('../', import.meta.url);
const raw = (p) => readFileSync(new URL(p, ROOT));
const read = (p) => raw(p).toString('utf8');
const sha = (p) => createHash('sha256').update(raw(p)).digest('hex');
const stop = (why) => { console.error('eval: ' + why); process.exit(1); };

if (!existsSync(new URL('SEAL2.md', ROOT))) stop('no SEAL2.md: the final shapes are not frozen, so V may not be read');
const seal = read('SEAL2.md');
for (const f of ['data/cell-adaptive.txt', 'data/cell-fixed.txt']) if (!seal.includes(sha(f))) stop(f + ' is not the cell seal 2 names');
if (sha('data/semeion.data') !== SEMEION_SHA256) stop('data/semeion.data is not the file seal 1 pinned');

const t0 = Date.now();
const runA = JSON.parse(read('data/run-adaptive.json')), runF = JSON.parse(read('data/run-fixed.json'));
const record = E.evaluate({ semText: read('data/semeion.data'), s0Text: read('vendor/settling-cell/data/cell.txt'), adaptiveText: read('data/cell-adaptive.txt'),
  fixedText: read('data/cell-fixed.txt'), adaptiveLog: runA.log, fixedLog: runF.log });
if (!record) stop('the record did not compute');
const out = JSON.stringify({ record, verdicts: E.verdicts(record), runs: { adaptive: runA.hash, fixed: runF.hash } }, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const same = read('data/record.json') === out;
  console.log(same ? 'RECORD REPRODUCED · ' + record.hash.slice(0, 16) : 'RECORD DIFFERS');
  process.exit(same ? 0 : 1);
}
writeFileSync(new URL('data/record.json', ROOT), out);
console.log('blind half: ' + record.blind + ' digits, three shapes, ' + Math.round((Date.now() - t0) / 1000) + ' s · record ' + record.hash);
for (const v of E.verdicts(record)) console.log((v.pass ? '  held   ' : '  FAILED ') + v.id + ' · ' + v.what + ' · ' + JSON.stringify(v.measured) + ' (bar ' + v.bar + ')');
