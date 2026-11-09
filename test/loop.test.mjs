// The Semeion conversion and the model-free loop, held to the sealed text. Fixtures come from the tune half T only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import S from '../src/semeion.mjs';
import L from '../src/loop.mjs';
import C from '../vendor/settling-cell/src/cell.mjs';
import { rng } from '../vendor/settling-cell/vendor/seed-library/seedlib.mjs';
import { sha256Hex } from '../vendor/settling-cell/vendor/seed-library/sha256.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const claims = read('CLAIMS.md').replace(/\s+/g, ' ');
const lines = read('data/semeion.data').trim().split('\n');
const tune = S.parse(lines.slice(0, S.SPLIT).join('\n'));
const s0 = read('vendor/settling-cell/data/cell.txt');
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const line = (on, label) => [...Array.from({ length: 256 }, (_, i) => (on.includes(i) ? '1.0000' : '0.0000')), ...Array.from({ length: 10 }, (_, k) => (k === label ? '1' : '0'))].join(' ');

test('the sealed numbers in the code are the ones CLAIMS.md states', () => {
  for (const s of ['of 100 items from T', '6 of its 64 pixels (10%)', '≥ 2. A proposal', 'starts at 100, gains 10', 'to at most 1,000) and loses 1', 'to at least 1', '1,500 cycles each', 'rng 4242; exam order 777; exam noise seed 50,000', 'R ± 4', 'n ± 1, within 2..8', 'move 8 pixels', 'rows 0–795 (796 digits)'])
    assert.ok(claims.includes(s), 'CLAIMS.md says: ' + s);
  assert.deepEqual(L.CFG, { batch: 100, gate: 2, cycles: 1500, loopSeed: 4242, examSeed: 777, noiseBase: 50000, noisePixels: 6, w0: 100, up: 10, down: 1, wMax: 1000, wMin: 1, moves: 8, reachStep: 4, nMin: 2, nMax: 8 });
  assert.ok(Object.isFrozen(L.CFG) && Object.isFrozen(L.OPS));
  assert.deepEqual(L.OPS, ['nudge', 'reseed', 'blend', 'push', 'reach', 'power']);
  assert.deepEqual([S.SIDE, S.GRID, S.CLASSES, S.SPLIT], [16, 8, 10, 796]);
});

test('Semeion parse: 2×2 blocks become ink 0..16, bad lines are counted, never thrown', () => {
  const r = S.parse([line([], 3), line([0, 1, 16, 17], 0), line([3 * 16 + 5], 9), '', line([], 3).replace('1 0 0 0 0 0 0', '1 1 0 0 0 0 0'), line([], 3).replace(/ 1( |$)/, ' 0$1'),
    line([], 3).replace('0.0000', '2'), line([], 3).replace('0.0000', '0.5'), line([], 3).replace('0.0000', '1.0001'), line([], 3).split(' ').slice(1).join(' '), line([2], 4).replace('1.0000', '1')].join('\n'));
  assert.equal(r.x.length, 4);
  assert.deepEqual(r.y, [3, 0, 9, 4]);
  assert.equal(r.bad, 6);
  assert.ok(r.x[0].every((v) => v === 0));
  assert.equal(r.x[1][0], 16);
  assert.equal(r.x[1].reduce((a, b) => a + b, 0), 16);
  assert.equal(r.x[2][1 * 8 + 2], 4);
  assert.equal(r.x[2].reduce((a, b) => a + b, 0), 4);
  assert.equal(r.x[3][1], 4);
  for (const g of [null, undefined, 7, 'x']) assert.doesNotThrow(() => S.parse(g));
  assert.deepEqual(S.parse(null), { x: [], y: [], bad: 0 });
  const all = S.parse(read('data/semeion.data'));
  assert.deepEqual([all.x.length, all.bad, all.y[0], all.y[S.SPLIT - 1], all.y[S.SPLIT]], [1593, 0, 0, 9, 0]);
  const h = S.halves(all);
  assert.deepEqual([h.T.x.length, h.V.x.length, h.T.y.length, h.V.y.length], [796, 797, 796, 797]);
  assert.equal(h.V.x[0], all.x[S.SPLIT]);
  assert.equal(h.T.x[795], all.x[795]);
  assert.deepEqual(C.inkOf(C.encode(r.x[1], 4), 4)[0], 4, 'four on-pixels in a block are level 4 under the thermometer code');
});

test('shapes as levels: Rung 1\'s cell round-trips exactly, and bits follow the thermometer rule', () => {
  assert.equal(L.textOf(L.levelsShape(s0)), s0);
  assert.equal(L.levelsShape('nope'), null);
  assert.deepEqual(Array.from(L.bitsOf([0, 3, 4, 1], 4)), [0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0]);
  const sh = L.levelsShape(s0);
  assert.deepEqual([sh.b, sh.k, sh.N, sh.R, sh.n, sh.lv.length, sh.lv[0].length], [4, 20, 256, 64, 6, 200, 64]);
  assert.ok(L.cellOf(sh));
  assert.equal(L.cellOf({ ...sh, R: 64, n: 9 }), null);
});

test('the exam stream: fresh orders each epoch, every row from T, none repeated within an epoch', () => {
  assert.equal(Array.from(L.examRows(5, 12, 3)).join(','), '2,4,1,0,3,3,2,0,1,4,2,1');
  assert.equal(L.examRows(0, 5, 3).length, 0);
  assert.deepEqual(Array.from(L.examRows(1, 4, 3)), [0, 0, 0, 0]);
  const rows = L.examRows(S.SPLIT, L.CFG.cycles * L.CFG.batch, L.CFG.examSeed);
  assert.equal(rows.length, 150000);
  for (let e = 0; e * S.SPLIT < rows.length; e++) {
    const ep = Array.from(rows.slice(e * S.SPLIT, (e + 1) * S.SPLIT));
    assert.equal(new Set(ep).size, ep.length, 'no row twice in one epoch');
    assert.ok(ep.every((r) => r >= 0 && r < S.SPLIT), 'every exam row is a T row');
  }
  const b = L.batchOf(tune, rows, 3, 4);
  assert.deepEqual(b.map((x) => x.i), Array.from({ length: 100 }, (_, q) => 300 + q), 'item i carries noise seed 50,000 + i, so no item repeats');
  assert.deepEqual(b[0].bits, C.encode(C.noisy(tune.x[rows[300]], 6, 50300), 4));
  assert.equal(b[7].y, tune.y[rows[307]]);
});

test('pick, l1, nearestOf, shuffled: the small parts, tie for tie', () => {
  assert.equal(L.pick([1, 1], () => 0.5), 1);
  assert.equal(L.pick([1, 1], () => 0.49), 0);
  assert.equal(L.pick([3, 1, 6], () => 0.35), 1);
  assert.equal(L.pick([3, 1, 6], () => 0.4), 2);
  assert.equal(L.pick([3, 1, 6], () => 0), 0);
  assert.equal(L.l1([0, 4, 2], [1, 1, 2]), 4);
  const sh = { lv: [[0, 0], [4, 4], [1, 1], [3, 3]], cls: [0, 1, 0, 1] };
  assert.equal(L.nearestOf(sh, 0, [2, 2]), 2);
  assert.equal(L.nearestOf(sh, 1, [2, 2]), 3);
  assert.equal(L.nearestOf({ lv: [[1], [1]], cls: [5, 5] }, 5, [1]), 0, 'the lowest index on a tie');
  assert.equal(L.nearestOf(sh, 7, [1, 1]), -1);
  assert.equal(L.shuffled(10, rng(5)).join(','), '5,3,7,8,2,0,4,1,9,6');
  assert.deepEqual(L.shuffled(0, rng(5)), []);
  assert.deepEqual(L.shuffled(1, rng(5)), [0]);
});

const tiny = () => ({ b: 4, k: 1, N: 8, R: 8, n: 2, cls: [0, 1], lv: [[0, 4], [2, 2]] });
test('propose: each operator does exactly what the seal says', () => {
  const nud = (r) => L.propose(tiny(), 'nudge', seq(...r), []).lv;
  assert.deepEqual(nud([0, 0, 0.2]), [[1, 4], [2, 2]], 'level 0 pushed down reflects up');
  assert.deepEqual(nud([0, 0.6, 0.7]), [[0, 3], [2, 2]], 'level 4 pushed up reflects down');
  assert.deepEqual(nud([0.6, 0, 0.2]), [[0, 4], [1, 2]]);
  assert.deepEqual(nud([0.6, 0.6, 0.7]), [[0, 4], [2, 3]]);
  assert.deepEqual(L.propose(tiny(), 'nudge', seq(0.6, 0.6, 0.7), []).R, 8, 'nudge leaves R alone');
  const mid = () => ({ ...tiny(), lv: [[3, 1], [2, 2]] });
  assert.deepEqual(L.propose(mid(), 'nudge', seq(0, 0, 0.7), []).lv[0], [4, 1], 'level 3 up reaches 4: allowed');
  assert.deepEqual(L.propose(mid(), 'nudge', seq(0, 0.6, 0.2), []).lv[0], [3, 0], 'level 1 down reaches 0: allowed');
  assert.deepEqual(L.propose(mid(), 'nudge', seq(0, 0.6, 0.5), []).lv[0], [3, 2], 'a draw of exactly 0.5 goes up');
  assert.equal(L.propose(tiny(), 'reach', seq(0.5), []), null, 'a draw of exactly 0.5 goes up: R = 12 passes N');
  assert.equal(L.propose(tiny(), 'power', seq(0.5), []).n, 3, 'a draw of exactly 0.5 goes up');
  assert.equal(L.propose({ ...tiny(), n: 7 }, 'power', seq(0.7), []).n, 8, 'n = 8 is allowed');
  assert.equal(L.propose(tiny(), 'reach', seq(0.7), []), null, 'R = 8 + 4 would pass N');
  assert.equal(L.propose(tiny(), 'reach', seq(0.2), []).R, 4);
  assert.equal(L.propose({ ...tiny(), R: 4 }, 'reach', seq(0.2), []), null, 'R = 0 is out of range');
  assert.equal(L.propose({ ...tiny(), R: 5 }, 'reach', seq(0.2), []).R, 1);
  assert.equal(L.propose({ ...tiny(), R: 4 }, 'reach', seq(0.7), []).R, 8, 'R = N is allowed');
  assert.equal(L.propose(tiny(), 'power', seq(0.2), []), null, 'n = 1 is under 2');
  assert.equal(L.propose(tiny(), 'power', seq(0.7), []).n, 3);
  assert.equal(L.propose({ ...tiny(), n: 8 }, 'power', seq(0.7), []), null);
  assert.equal(L.propose({ ...tiny(), n: 3 }, 'power', seq(0.2), []).n, 2);
  for (const op of ['reseed', 'blend', 'push']) assert.equal(L.propose(tiny(), op, seq(0), []), null, op + ' with no errors');
  assert.equal(L.propose(tiny(), 'push', seq(0), [{ lv: [1, 1], y: 0, answer: -1 }]), null, 'push needs a wrong winner');
  const err = { lv: [3, 1], y: 1, answer: 0 };
  assert.deepEqual(L.propose(tiny(), 'reseed', seq(0, 0), [err]).lv, [[0, 4], [3, 1]], 'reseed replaces a pattern of the error\'s own class');
  const sh2 = { b: 4, k: 2, N: 8, R: 8, n: 2, cls: [0, 0, 1, 1], lv: [[0, 0], [4, 4], [2, 2], [1, 1]] };
  assert.deepEqual(L.propose(sh2, 'reseed', seq(0, 0.6), [{ lv: [3, 3], y: 0, answer: 1 }]).lv[1], [3, 3]);
  assert.deepEqual(L.propose(sh2, 'reseed', seq(0, 0), [{ lv: [3, 3], y: 0, answer: 1 }]).lv, [[3, 3], [4, 4], [2, 2], [1, 1]], 'pattern 0 can be the one replaced');
  assert.deepEqual(L.propose(sh2, 'reseed', seq(0, 0.6), [{ lv: [3, 3], y: 1, answer: 0 }]).lv[3], [3, 3], 'only the error\'s own class');
  const bl = L.propose(tiny(), 'blend', seq(0, 0.1, 0.9), [err]);
  assert.deepEqual(bl.lv, [[0, 4], [3, 1]], 'blend moves the right class\'s nearest pattern to the error\'s levels');
  const ps = L.propose(tiny(), 'push', seq(0, 0.1, 0.9), [{ lv: [0, 2], y: 1, answer: 0 }]);
  assert.deepEqual(ps.lv, [[1, 4], [2, 2]], 'push moves the wrong winner one level away where it agreed with the error');
  const ps4 = L.propose({ ...tiny(), lv: [[4, 2], [2, 2]] }, 'push', seq(0, 0.9, 0.1), [{ lv: [4, 2], y: 1, answer: 0 }]);
  assert.deepEqual(ps4.lv[0], [3, 1]);
  const ps5 = L.propose({ ...tiny(), lv: [[4, 2], [2, 2]] }, 'push', seq(0, 0.9, 0.7), [{ lv: [4, 2], y: 1, answer: 0 }]);
  assert.deepEqual(ps5.lv[0], [3, 3]);
  const ps6 = L.propose({ ...tiny(), lv: [[4, 2], [2, 2]] }, 'push', seq(0, 0.9, 0.5), [{ lv: [4, 2], y: 1, answer: 0 }]);
  assert.deepEqual(ps6.lv[0], [3, 3], 'a draw of exactly 0.5 pushes up');
  const big = { b: 4, k: 1, N: 64, R: 8, n: 2, cls: [0, 1], lv: [new Array(64).fill(0), new Array(64).fill(2)] };
  const many = L.propose(big, 'blend', rng(9), [{ lv: new Array(64).fill(4), y: 0, answer: 1 }]);
  assert.equal(many.lv[0].filter((v) => v === 4).length, 8, 'blend moves exactly 8 pixels');
  const pm = L.propose(big, 'push', rng(9), [{ lv: new Array(64).fill(2), y: 0, answer: 1 }]);
  assert.equal(pm.lv[1].filter((v) => v !== 2).length, 8, 'push moves exactly 8 pixels');
  assert.deepEqual(tiny().lv, [[0, 4], [2, 2]], 'propose never changes the shape it was given');
  const orig = tiny(); L.propose(orig, 'blend', seq(0, 0.1, 0.9), [err]); assert.deepEqual(orig.lv, [[0, 4], [2, 2]]);
});

test('settleAll and judge: wins, losses, and the right vector', () => {
  assert.deepEqual(L.judge(Uint8Array.from([1, 0, 1, 0]), Uint8Array.from([1, 1, 0, 0])), { wins: 1, losses: 1 });
  assert.deepEqual(L.judge(Uint8Array.from([0, 0, 0]), Uint8Array.from([1, 1, 0])), { wins: 2, losses: 0 });
  assert.deepEqual(L.judge(Uint8Array.from([1, 1]), Uint8Array.from([0, 1])), { wins: 0, losses: 1 });
  const c = L.cellOf(L.levelsShape(s0));
  const items = [0, 1, 2].map((q) => ({ y: tune.y[q], bits: C.encode(tune.x[q], 4) }));
  const s = L.settleAll(c, items);
  assert.deepEqual(Array.from(s.answer), items.map((it) => C.settle(c, it.bits).answer));
  assert.deepEqual(Array.from(s.right), items.map((it, q) => (s.answer[q] === it.y ? 1 : 0)));
});

const T200 = { x: tune.x.slice(0, 200), y: tune.y.slice(0, 200) };
const cfg = { ...L.CFG, batch: 20, gate: 1, up: 400, down: 60 };
test('runLoop: the adaptive loop and its twin, cycle for cycle, on a fixture from T', () => {
  const a = L.runLoop(T200, s0, { cycles: 16, cfg }), f = L.runLoop(T200, s0, { cycles: 16, cfg, adaptive: false });
  assert.equal(a.hash, 'c0f8495e76f435aaec8c4538b1ee26ed2cc61edd84d897d5eacc7060b85284da');
  assert.equal(f.hash, '9fd8d012a969db4432b8b7143c584ad7b24025413fe59f77a2a03db9d81aee9c');
  assert.deepEqual(a.weights, [40, 1, 40, 1, 940, 40]);
  assert.deepEqual(f.weights, [100, 100, 100, 100, 100, 100], 'the twin never moves its weights');
  assert.deepEqual(a.log.slice(0, 8), [[3, 0, 0, 0, 0], [1, 1, 0, 0, 0], [4, 1, 0, 0, 1], [1, 1, 0, 0, 0], [3, 0, 0, 0, 0], [5, 1, 0, 0, 0], [2, 1, 0, 0, 0], [4, 1, 1, 1, 0]]);
  assert.equal(a.log.filter((e) => e[2]).length, 3);
  assert.equal(sha256Hex(a.text).slice(0, 16), 'e26063f55ec0246d');
  assert.equal(sha256Hex(f.text).slice(0, 16), '1b1c27c5e55c90a4');
  assert.equal(L.runLoop(T200, s0, { cycles: 16, cfg }).hash, a.hash, 'two runs, one hash');
  assert.equal(L.runLoop(T200, 'nope', { cycles: 2, cfg }), null);
  const def = L.runLoop(T200, s0, { cycles: 1 });
  assert.equal(def.log.length, 1);
  assert.ok(a.log.every(([, built, acc, w, l]) => acc === (built === 1 && w - l >= 1 ? 1 : 0)), 'accepted exactly when the gate cleared');
});

test('the loop is model-free: it imports only the vendored kernel, rng and SHA-256, and calls nothing outside', () => {
  const src = read('src/loop.mjs');
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['../vendor/settling-cell/src/cell.mjs', '../vendor/settling-cell/vendor/seed-library/seedlib.mjs', '../vendor/settling-cell/vendor/seed-library/sha256.mjs']);
  for (const bad of [/fetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /import\s*\(/, /require\s*\(/, /\bnew Worker\b/, /ollama|openai|anthropic|onnx|tensor/i]) assert.equal(bad.test(src), false, String(bad));
  assert.equal(/^import /m.test(read('src/semeion.mjs')), false, 'the data code imports nothing');
});
