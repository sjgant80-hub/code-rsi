// The blind-half evaluator, held to the sealed text. Its fixture's "blind" rows are copies of tune rows, so no real V row
// is read before seal 2; the real V is read once, by tools/eval.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import S from '../src/semeion.mjs';
import L from '../src/loop.mjs';
import E from '../src/eval.mjs';
import C from '../vendor/settling-cell/src/cell.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const claims = read('CLAIMS.md').replace(/\s+/g, ' ');
const lines = read('data/semeion.data').trim().split('\n');
const tune = S.parse(lines.slice(0, S.SPLIT).join('\n'));
const s0 = read('vendor/settling-cell/data/cell.txt');

test('the bars, the noise and the bootstrap are the ones CLAIMS.md states', () => {
  for (const s of ['(16 of 64, seed 2026 + the row): lower bound > 0', 'lower bound > −0.5 points', '2,000 resamples, seed 99', 'pooled over clean and 25% noise V items: lower bound > 0'])
    assert.ok(claims.includes(s), 'CLAIMS.md says: ' + s);
  assert.deepEqual(E.BARS, { R1: 0, R2: 0, R3noisy: 0, R3clean: -0.005, R4: 0 });
  assert.deepEqual(E.NOISE, { pixels: 16, seed: 2026 });
  assert.deepEqual(E.BOOT, { n: 2000, seed: 99 });
  assert.ok(Object.isFrozen(E.BARS) && Object.isFrozen(E.NOISE) && Object.isFrozen(E.BOOT));
});

test('gateHeld: the gate both ways, on forged logs', () => {
  assert.equal(E.gateHeld([[0, 1, 1, 2, 0], [1, 1, 0, 1, 0], [2, 0, 0, 0, 0]], 2), true);
  assert.equal(E.gateHeld([[0, 1, 1, 3, 1]], 2), true, 'wins − losses = 2 clears a gate of 2');
  assert.equal(E.gateHeld([[0, 1, 1, 2, 1]], 2), false, 'an accept below the gate');
  assert.equal(E.gateHeld([[0, 1, 0, 4, 1]], 2), false, 'a cleared proposal turned away');
  assert.equal(E.gateHeld([[0, 0, 1, 5, 0]], 2), false, 'an accept with no proposal built');
  assert.equal(E.gateHeld([[0, 0, 0, 5, 0]], 2), true, 'an unbuilt proposal is never accepted, whatever its counts');
  assert.equal(E.gateHeld([], 2), true);
});

test('readAll: every V digit read both ways, clean and noisy, with a forced cap to count unsettled digits', () => {
  const sh = L.levelsShape(s0);
  for (let c = 0; c !== 10; c++) sh.lv[c * 20] = C.inkOf(C.encode(tune.x[tune.y.indexOf(c)], 4), 4);
  const cell = L.cellOf(sh), V = { x: tune.x.slice(0, 30), y: tune.y.slice(0, 30) }, lines2 = [];
  const out = E.readAll(cell, V, lines2, 'x');
  assert.equal(out.unsettled, 0);
  assert.equal(E.readAll(cell, V, [], 'x', 1).unsettled, 12, 'a one-sweep cap leaves 12 of 60 settles unfinished');
  assert.equal(lines2.length, 60);
  assert.ok(lines2[0].startsWith('x clean 796 '));
  assert.ok(lines2[1].startsWith('x n25 796 '));
  const bits = C.encode(C.noisy(V.x[3], 16, 2026 + 799), 4);
  assert.equal(out.n25[3], C.settle(cell, bits).answer === V.y[3] ? 1 : 0, 'noise seed is 2026 + the Semeion row');
  assert.equal(out.n25One[3], C.readout(cell, bits).answer === V.y[3] ? 1 : 0);
  assert.deepEqual([out.clean.length, out.cleanOne.length, out.n25.length, out.n25One.length], [30, 30, 30, 30]);
});

const T200 = { x: tune.x.slice(0, 200), y: tune.y.slice(0, 200) };
const cfg = { ...L.CFG, batch: 20, gate: 1, up: 400, down: 60 };
test('evaluate: the whole record on a fixture, number for number', () => {
  const a = L.runLoop(T200, s0, { cycles: 16, cfg }), f = L.runLoop(T200, s0, { cycles: 16, cfg, adaptive: false });
  const semText = [...lines.slice(0, S.SPLIT), ...lines.slice(0, 40)].join('\n');
  const r = E.evaluate({ semText, s0Text: s0, adaptiveText: a.text, fixedText: f.text, adaptiveLog: a.log, fixedLog: f.log });
  assert.deepEqual([r.blind, r.tune, r.settles, r.unsettled], [40, 796, 240, 0]);
  assert.deepEqual(r.s0, { clean: 0.275, cleanOne: 0.275, n25: 0.175, n25One: 0.125 });
  assert.deepEqual(r.star, { clean: 0.275, cleanOne: 0.275, n25: 0.175, n25One: 0.2 });
  assert.deepEqual(r.twin, { clean: 0.275, cleanOne: 0.275, n25: 0.175, n25One: 0.125 });
  assert.equal(r.nnTune, 1, 'these "blind" rows are copies of tune rows, so 1-NN over T finds each one');
  assert.deepEqual(r.lows, { R1: 0, R2: -0.075, R3noisy: -0.075, R3clean: 0, R4: -0.0375 });
  assert.deepEqual(r.gate, { adaptive: false, fixed: false }, 'the fixture ran with gate 1; the sealed gate is 2, and the check sees it');
  assert.deepEqual(r.accepted, { adaptive: 3, fixed: 1 });
  assert.equal(r.hashes.s0.slice(0, 12), '095d33a8bb6d');
  assert.equal(r.hash, '99ffc57501100ec9544a9e49ef53e26f633ff545da026a9ba88bb996aa9d2083');
  assert.equal(E.evaluate({ semText, s0Text: 'nope', adaptiveText: a.text, fixedText: f.text, adaptiveLog: a.log, fixedLog: f.log }), null);
  assert.equal(E.evaluate({ semText: lines.slice(0, S.SPLIT).join('\n'), s0Text: s0, adaptiveText: a.text, fixedText: f.text, adaptiveLog: a.log, fixedLog: f.log }), null, 'no blind rows, no record');
});

const rec = (o = {}) => ({ lows: { R1: 0.0001, R2: 0.0001, R3noisy: 0.0001, R3clean: -0.0049, R4: 0.0001 }, gate: { adaptive: true, fixed: true }, unsettled: 0, ...o });
test('verdicts: every bar strict or inclusive exactly as sealed', () => {
  const pass = (r) => Object.fromEntries(E.verdicts(r).map((v) => [v.id, v.pass]));
  assert.deepEqual(pass(rec()), { R1: true, R2: true, R3: true, R4: true, R6: true, R9: true });
  const fail = (o) => Object.entries(pass(rec(o))).filter(([, v]) => !v).map(([k]) => k);
  const lows = (o) => ({ lows: { ...rec().lows, ...o } });
  assert.deepEqual(fail(lows({ R1: 0 })), ['R1']);
  assert.deepEqual(fail(lows({ R2: 0 })), ['R2']);
  assert.deepEqual(fail(lows({ R3noisy: 0 })), ['R3']);
  assert.deepEqual(fail(lows({ R3clean: -0.005 })), ['R3']);
  assert.deepEqual(fail(lows({ R4: 0 })), ['R4']);
  assert.deepEqual(fail({ gate: { adaptive: false, fixed: true } }), ['R6']);
  assert.deepEqual(fail({ gate: { adaptive: true, fixed: false } }), ['R6']);
  assert.deepEqual(fail({ unsettled: 1 }), ['R9']);
  const v = E.verdicts(rec());
  assert.deepEqual(v.map((x) => x.id), ['R1', 'R2', 'R3', 'R4', 'R6', 'R9']);
  assert.deepEqual(v.map((x) => x.bar), ['above 0', 'above 0', 'above 0 at 25% noise and above -0.005 clean', 'above 0', 'true and true', 'none']);
  assert.deepEqual(v.map((x) => x.measured), [0.0001, 0.0001, [0.0001, -0.0049], 0.0001, [true, true], 0]);
  assert.ok(v.every((x) => typeof x.what === 'string' && x.what.length > 10));
});
