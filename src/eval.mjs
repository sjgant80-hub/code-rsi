// src/eval.mjs — the blind half V, read once after seal 2: the starting cell S0, the adaptive loop's final shape S* and
// the frozen twin's final shape, each settled and read in one step on every V digit, clean and with 25% of the pixels
// replaced; the paired bootstraps; and every claim judged against the bar CLAIMS.md fixed before any code. Pure and
// browser-safe: the page's worker runs this same function and must reproduce the record's hash.
import C from '../vendor/settling-cell/src/cell.mjs';
import { sha256Hex } from '../vendor/settling-cell/vendor/seed-library/sha256.mjs';
import { round6 } from '../vendor/settling-cell/vendor/seed-library/seedlib.mjs';
import S from './semeion.mjs';
import L from './loop.mjs';

export const BARS = Object.freeze({ R1: 0, R2: 0, R3noisy: 0, R3clean: -0.005, R4: 0 });
export const NOISE = Object.freeze({ pixels: 16, seed: 2026 });
export const BOOT = Object.freeze({ n: 2000, seed: 99 });

const sum = (v) => v.reduce((s, a) => s + a, 0);
const share = (v) => round6(sum(v) / v.length);

/** readAll(c, V, lines, tag, cap) → for every V digit: settled and one-step right, clean and at 25% noise; how many
 *  settles did not stop within the cap (the sealed cap unless a test passes another); one record line per settle. */
export function readAll(c, V, lines, tag, cap = C.MAX_SWEEPS) {
  const out = { clean: [], cleanOne: [], n25: [], n25One: [], unsettled: 0 };
  for (let i = 0; i !== V.x.length; i++) {
    const row = S.SPLIT + i, y = V.y[i];
    for (const [k, px] of [['clean', V.x[i]], ['n25', C.noisy(V.x[i], NOISE.pixels, NOISE.seed + row)]]) {
      const bits = C.encode(px, 4), st = C.settle(c, bits, { maxSweeps: cap }), one = C.readout(c, bits).answer;
      out[k].push(st.answer === y ? 1 : 0);
      out[k + 'One'].push(one === y ? 1 : 0);
      out.unsettled += st.settled ? 0 : 1;
      lines.push(tag + ' ' + k + ' ' + row + ' ' + st.answer + ' ' + one + ' ' + st.fit + ' ' + st.flips + ' ' + st.sweeps);
    }
  }
  return out;
}

/** gateHeld(log, gate) → true when the gate held both ways: every accepted cycle cleared it, and every built proposal
 *  that did not clear it was turned away. */
export function gateHeld(log, gate) {
  return log.every(([, built, acc, wins, losses]) => (acc === 1) === (built === 1 && wins - losses >= gate));
}

/** evaluate({ semText, s0Text, adaptiveText, fixedText, adaptiveLog, fixedLog }) → the record. */
export function evaluate({ semText, s0Text, adaptiveText, fixedText, adaptiveLog, fixedLog }) {
  const { T, V } = S.halves(S.parse(semText));
  const cells = [s0Text, adaptiveText, fixedText].map((t) => { const sh = L.levelsShape(t); return sh && L.cellOf(sh); });
  if (cells.some((c) => !c) || !V.x.length || !T.x.length) return null;
  const lines = [], [s0, star, twin] = cells.map((c, j) => readAll(c, V, lines, ['s0', 'star', 'twin'][j]));
  const trainW = T.x.map((p) => C.pack(C.encode(p, 4)));
  const nn = V.x.map((p, i) => (T.y[C.nearestIndex(trainW, C.pack(C.encode(p, 4)))] === V.y[i] ? 1 : 0));
  const low = (a, b) => round6(C.pairedLow(a, b, BOOT.n, BOOT.seed));
  const acc = (o) => ({ clean: share(o.clean), cleanOne: share(o.cleanOne), n25: share(o.n25), n25One: share(o.n25One) });
  return {
    blind: V.x.length, tune: T.x.length, hashes: { s0: sha256Hex(s0Text), star: sha256Hex(adaptiveText), twin: sha256Hex(fixedText) },
    s0: acc(s0), star: acc(star), twin: acc(twin), nnTune: share(nn),
    lows: { R1: low(star.clean, s0.clean), R2: low(star.n25, s0.n25), R3noisy: low(star.n25, star.n25One), R3clean: low(star.clean, star.cleanOne),
      R4: low([...star.clean, ...star.n25], [...twin.clean, ...twin.n25]) },
    gate: { adaptive: gateHeld(adaptiveLog, L.CFG.gate), fixed: gateHeld(fixedLog, L.CFG.gate) },
    accepted: { adaptive: adaptiveLog.filter((e) => e[2] === 1).length, fixed: fixedLog.filter((e) => e[2] === 1).length },
    unsettled: s0.unsettled + star.unsettled + twin.unsettled,
    settles: lines.length, hash: sha256Hex(lines.join('\n') + '\n'),
  };
}

/** verdicts(r) → each sealed claim beside its bar. */
export function verdicts(r) {
  return [
    { id: 'R1', what: 'S* against S0, settling clean blind digits: 95% lower bound', measured: r.lows.R1, bar: 'above ' + BARS.R1, pass: r.lows.R1 > BARS.R1 },
    { id: 'R2', what: 'S* against S0 with 25% of the pixels replaced: 95% lower bound', measured: r.lows.R2, bar: 'above ' + BARS.R2, pass: r.lows.R2 > BARS.R2 },
    { id: 'R3', what: 'S* settling against S* read in one step: lower bound at 25% noise, and clean', measured: [r.lows.R3noisy, r.lows.R3clean], bar: 'above ' + BARS.R3noisy + ' at 25% noise and above ' + BARS.R3clean + ' clean', pass: r.lows.R3noisy > BARS.R3noisy && r.lows.R3clean > BARS.R3clean },
    { id: 'R4', what: 'S* against the frozen-weights twin, clean and 25% noise pooled: lower bound', measured: r.lows.R4, bar: 'above ' + BARS.R4, pass: r.lows.R4 > BARS.R4 },
    { id: 'R6', what: 'the gate held both ways on every cycle of both runs', measured: [r.gate.adaptive, r.gate.fixed], bar: 'true and true', pass: r.gate.adaptive && r.gate.fixed },
    { id: 'R9', what: 'settles on the blind half that did not stop', measured: r.unsettled, bar: 'none', pass: r.unsettled === 0 },
  ];
}

export default { BARS, NOISE, BOOT, readAll, gateHeld, evaluate, verdicts };
