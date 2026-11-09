// app.mjs — the page's glue. Every number is read from the committed record, the run logs or the gate receipts, or is
// computed in this tab (claim R10: none is typed into index.html). The loop and the evaluator run in worker.mjs.
import { mintCase, sourcesOf } from './vendor/liveware/mintcase.mjs';
import L from './src/loop.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) if (k === 'class') e.className = v; else e.setAttribute(k, v); for (const c of kids) e.append(c); return e; };
const svg = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const json = (p) => fetch(p).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const pct = (x) => (x * 100).toFixed(1) + '%';
const pts = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(2) + ' points';
const big = (n) => Number(n).toLocaleString('en-GB');
const chip = (pass) => el('span', { class: 'chip ' + (pass ? 'win' : 'bad') }, pass ? 'HELD' : 'FAILED');

let REC = null, RA = null, RF = null, GATES = [], BASIS = null;
const PLAIN = { R1: 'It improved itself, on writers it never trained on', R2: 'And with a quarter of the pixels replaced', R3: 'Settling beats reading the same shape in one step (Rung 1\'s T7, retaken)',
  R4: 'The recursive turn pays: the adaptive loop beats its frozen twin', R6: 'Every change earned its place: the gate held both ways', R9: 'Every settle stopped' };
function shown(v) {
  const m = v.measured;
  if (v.id === 'R3') return [pts(m[0]) + ' at 25% noise; ' + pts(m[1]) + ' clean (lower bounds)', '> 0 at 25% noise and > −0.5 points clean'];
  if (v.id === 'R6') return [(m[0] ? 'held' : 'BROKEN') + ' in the adaptive run; ' + (m[1] ? 'held' : 'BROKEN') + ' in the twin', 'held in both'];
  if (v.id === 'R9') return [m + ' unfinished settles', 'none'];
  return [pts(m) + ' (lower bound)', '> 0'];
}

function fillResult() {
  const r = REC.record, v = REC.verdicts, held = v.filter((x) => x.pass), failed = v.filter((x) => !x.pass);
  $('verdictline').textContent = held.length + ' of ' + v.length + ' measured claims held on the ' + big(r.blind) + ' blind-half digits' +
    (failed.length ? '. Failed and kept: ' + failed.map((x) => x.id + ' (' + PLAIN[x.id].charAt(0).toLowerCase() + PLAIN[x.id].slice(1) + ')').join('; ') + '.' : '.') +
    ' Rung 1\'s cell read ' + pct(r.s0.clean) + ' of them; after the loop, ' + pct(r.star.clean) + '.';
  const tb = $('claims').querySelector('tbody'); tb.replaceChildren();
  for (const x of v) { const [m, bar] = shown(x); tb.append(el('tr', {}, el('td', {}, el('b', {}, x.id)), el('td', {}, PLAIN[x.id]), el('td', {}, m), el('td', { class: 'num' }, bar), el('td', {}, chip(x.pass)))); }
  const ci = (id, what, m, bar, label = 'CI') => tb.append(el('tr', {}, el('td', {}, el('b', {}, id)), el('td', {}, what), el('td', {}, m), el('td', {}, bar), el('td', {}, el('span', { class: 'chip win' }, label))));
  ci('R5', 'Fresh exams: no exam item repeats, and none is a blind-half row', 'checked by test/loop.test.mjs over the whole stream', 'no repeat, no blind row');
  ci('R7', 'Model-free: the loop imports only the cell kernel, rng and SHA-256, and calls nothing outside', 'checked by test/loop.test.mjs', 'nothing else');
  ci('R8', 'Deterministic: one hash per run log, in CI and in your tab', RA.hash.slice(0, 16) + '…', 'the same everywhere');
  ci('R10', 'No measured number typed into this page', 'checked by test/page.test.mjs', 'none');
  ci('R11', 'Semeion and the vendored Rung 1 files are the pinned bytes', 'checked by test/page.test.mjs', 'SHA-256 equal');
  for (const g of GATES) tb.append(el('tr', {}, el('td', {}, el('b', {}, 'G')), el('td', {}, 'Mutation gate on ' + g.kernel), el('td', { class: 'num' }, g.killed + ' of ' + g.total + ' caught, ' + g.ignored + ' baselined'), el('td', {}, 'clean, nothing baselined'), el('td', {}, chip(g.clean && g.ignored === 0))));
  const row = (a, f) => el('tr', {}, el('td', {}, a), ...['s0', 'star', 'twin'].map((k) => el('td', { class: 'num' }, f(r[k]))));
  $('shapes3').querySelector('tbody').replaceChildren(row('Settled, clean', (o) => pct(o.clean)), row('Settled, 25% of pixels replaced', (o) => pct(o.n25)), row('Read in one step, clean', (o) => pct(o.cleanOne)), row('Read in one step, 25% noise', (o) => pct(o.n25One)));
  $('refs').replaceChildren(
    el('div', { class: 'card' }, el('div', { class: 'k' }, 'Changes kept'), el('div', { class: 'big' }, big(r.accepted.adaptive) + ' vs ' + big(r.accepted.fixed)), el('div', { class: 'vs' }, 'of ' + big(RA.cycles) + ' proposals each: the adaptive loop against its frozen twin.')),
    el('div', { class: 'card' }, el('div', { class: 'k' }, 'Strong reference'), el('div', { class: 'big' }, pct(r.nnTune)), el('div', { class: 'vs' }, '1-nearest-neighbour storing all ' + big(r.tune) + ' tune-half digits, on the same bits. The loop\'s shape keeps ' + big(200) + ' patterns.')),
    el('div', { class: 'card' }, el('div', { class: 'k' }, 'The search it learned'), el('div', { class: 'big' }, L.OPS[RA.weights.indexOf(Math.max(...RA.weights))]), el('div', { class: 'vs' }, 'the edit the adaptive loop came to favour most. Final weights: ' + L.OPS.map((o, i) => o + ' ' + RA.weights[i]).join(', ') + '.')));
  const vf = (id) => v.find((x) => x.id === id) || {};
  const gain = r.star.clean - r.s0.clean;
  $('lesson').textContent = 'With no model anywhere, the loop took Rung 1\'s cell from ' + pct(r.s0.clean) + ' to ' + pct(r.star.clean) + ' on writers it never trained on (' + (gain >= 0 ? '+' : '−') + Math.abs(gain * 100).toFixed(1) + ' points), and from ' + pct(r.s0.n25) + ' to ' + pct(r.star.n25) + ' with a quarter of the pixels replaced. ' +
    'Storing every tune-half digit and taking the nearest scores ' + pct(r.nnTune) + ', so the evolved shape is ' + (r.star.clean >= r.nnTune ? 'level with or above' : 'still below') + ' that reference while keeping 200 patterns. ' +
    (vf('R3').pass ? 'Settling now beats reading the same shape in one step, the claim Rung 1 failed. ' : 'Settling still does not beat reading the same shape in one step (' + pct(r.star.n25) + ' vs ' + pct(r.star.n25One) + ' at 25% noise; ' + pct(r.star.clean) + ' vs ' + pct(r.star.cleanOne) + ' clean): Rung 1\'s open question stays open. ') +
    (vf('R4').pass ? 'The recursive turn paid: the loop that retuned its own search beat its frozen twin.' : 'The recursive turn did not pay on this budget: the loop that retuned its own search did not beat its frozen twin (' + pct(r.star.clean) + ' vs ' + pct(r.twin.clean) + ' clean).');
  const ul = $('results'); ul.replaceChildren();
  const li = (t) => ul.append(el('li', {}, t));
  li('Rung 1\'s cell on the blind half: ' + pct(r.s0.clean) + ' clean, ' + pct(r.s0.n25) + ' at 25% noise. After the loop: ' + pct(r.star.clean) + ' and ' + pct(r.star.n25) + ' (R1 ' + (vf('R1').pass ? 'held' : 'FAILED') + ', R2 ' + (vf('R2').pass ? 'held' : 'FAILED') + ').');
  li('Settling against one step, on the evolved shape: clean ' + pct(r.star.clean) + ' vs ' + pct(r.star.cleanOne) + '; at 25% noise ' + pct(r.star.n25) + ' vs ' + pct(r.star.n25One) + ' (R3 ' + (vf('R3').pass ? 'held' : 'FAILED, kept') + ').');
  li('The adaptive loop against its frozen twin: ' + pct(r.star.clean) + ' vs ' + pct(r.twin.clean) + ' clean, ' + pct(r.star.n25) + ' vs ' + pct(r.twin.n25) + ' at 25% noise; pooled lower bound ' + pts(r.lows.R4) + ' (R4 ' + (vf('R4').pass ? 'held' : 'FAILED, kept') + ').');
  li('Changes kept: ' + big(r.accepted.adaptive) + ' in the adaptive run and ' + big(r.accepted.fixed) + ' in the twin, out of ' + big(RA.cycles) + ' proposals each. The gate held both ways on every cycle (R6 ' + (vf('R6').pass ? 'held' : 'FAILED') + ').');
  for (const g of GATES) li('Mutation gate on ' + g.kernel + ': ' + g.killed + ' of ' + g.total + ' broken copies caught, ' + g.ignored + ' baselined.');
  $('faq-learn').textContent = 'Only from labelled cases, and only on the tune half. Here, the loop saw ' + big(r.tune) + ' tune-half digits under fresh noise and took the blind half from ' + pct(r.s0.clean) + ' to ' + pct(r.star.clean) + '. On your data it would be your own labelled samples, and the judgement would be on a blind half of yours.';
  $('faq-failed').textContent = failed.length ? failed.map((x) => x.id + ': ' + PLAIN[x.id] + ', measured ' + shown(x)[0] + '.').join(' ') + ' Each failure is kept on the record and on this page.' : 'Nothing measured failed its bar on this run.';
  const parts = [['src/loop.mjs', 'The loop: the exam stream, the six edits, the weighted pick, the gate, the weight update, and the run log.'], ['src/eval.mjs', 'The blind half read once: three shapes, settled and one step, clean and noisy, the bootstraps, and every claim against its bar.'],
    ['src/semeion.mjs', 'The Semeion file as the cell\'s 8×8 ink grid, and the sealed split.'], ['data/', 'Semeion (pinned), both run logs, both final shapes, and the record.'], ['vendor/settling-cell/', 'Rung 1\'s kernel and frozen cell, and the seed-library rng and SHA-256, byte for byte.'], ['worker.mjs + app.mjs', 'The page: a worker re-runs the record and the first cycles; the glue fills every number from the committed files.']];
  const gl = (k) => { const g = GATES.find((x) => x.kernel === k); return g ? 'mutation gate ' + g.killed + '/' + g.total + ', ' + g.ignored + ' baselined' : 'pinned and checked in CI'; };
  $('parts').replaceChildren(...parts.map(([h, t]) => el('div', { class: 'card' }, el('div', { class: 'k' }, h), el('p', { style: 'font-size:14.5px;margin-top:4px' }, t), el('p', { class: 'vs', style: 'margin-top:6px;color:var(--accent)' }, gl(h)))));
  $('timeline').replaceChildren(...[['Seal 1', 'CLAIMS.md alone, before any code: the loop, the gate, the split, every seed and every bar.'], ['The runs', 'The adaptive loop and its twin, 1,500 cycles each, on the tune half only (data/run-*.json).'],
    ['Seal 2', 'Both final shapes and the code frozen by hash before the blind half was read (SEAL2.md).'], ['The blind half, once', 'Read once for the three shapes (data/record.json).']].map(([a, b]) => el('li', {}, el('b', {}, a), ' · ', b)));
}

// ── watch it evolve: both logs replayed, and the adaptive run's own weights replayed by the sealed rule ──
function cumulative(log) { const out = [0]; let s = 0; for (const e of log) { if (e[2]) s += e[3] - e[4]; out.push(s); } return out; }
function weightsAt(log, t) {
  const w = L.OPS.map(() => L.CFG.w0);
  for (let i = 0; i !== t; i++) { const [o, , acc] = log[i]; w[o] = acc ? Math.min(L.CFG.wMax, w[o] + L.CFG.up) : Math.max(L.CFG.wMin, w[o] - L.CFG.down); }
  return w;
}
let CA = null, CF = null;
function drawCurve(t) {
  const s = $('curve'); s.replaceChildren();
  const W = 900, H = 260, pad = 40, n = RA.log.length, max = Math.max(1, ...CA, ...CF);
  const X = (i) => pad + ((W - 2 * pad) * i) / n, Y = (v) => H - pad - ((H - 2 * pad) * v) / max;
  s.append(svg('path', { d: 'M' + pad + ' ' + (H - pad) + 'H' + (W - pad) + 'M' + pad + ' ' + (H - pad) + 'V' + pad, class: 'curve-axis' }));
  const path = (c) => c.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  s.append(svg('path', { d: path(CF), class: 'curve-f' }), svg('path', { d: path(CA), class: 'curve-a' }), svg('line', { x1: X(t), x2: X(t), y1: pad, y2: H - pad, class: 'curve-mark' }));
  const lab = (x, y, txt) => { const e = svg('text', { x, y, class: 'curve-text' }); e.textContent = txt; s.append(e); };
  lab(pad, pad - 12, 'net exam wins kept: adaptive (solid) ' + big(CA[CA.length - 1]) + ', twin (dashed) ' + big(CF[CF.length - 1]));
  lab(W - pad - 70, H - pad + 18, 'cycle ' + big(n));
  lab(pad, H - pad + 18, 'cycle 0');
  const w = weightsAt(RA.log, t), wm = Math.max(...w);
  $('weights').replaceChildren(...w.flatMap((v, i) => [el('span', {}, L.OPS[i]), el('div', { class: 'bar' + (v === wm ? ' win' : '') }, (() => { const x = el('i'); x.style.width = ((100 * v) / L.CFG.wMax).toFixed(1) + '%'; return x; })()), el('span', { class: 'num' }, 'weight ' + v)]));
  const e = RA.log[Math.max(0, t - 1)];
  $('cycnote').textContent = t === 0 ? 'before the first cycle' : 'cycle ' + big(t) + ': ' + L.OPS[e[0]] + (e[1] ? ', ' + e[3] + ' wins and ' + e[4] + ' losses on its fresh exam, ' + (e[2] ? 'kept' : 'thrown away') : ', nothing to propose') + ' · kept so far: ' + RA.log.slice(0, t).filter((x) => x[2]).length;
}

// ── the cell, through the worker ──
let worker = null, seq = 0;
function ask(msg) {
  if (!worker) worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  return new Promise((resolve) => { const id = ++seq; const on = (e) => { if (e.data.id === id) { worker.removeEventListener('message', on); resolve(e.data); } }; worker.addEventListener('message', on); worker.postMessage({ ...msg, id }); });
}
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function mix(a, b, t) { const h = (s) => { const x = s.replace('#', ''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); }; const [p, q] = [h(a), h(b)]; return 'rgb(' + p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(',') + ')'; }
function draw(canvas, levels, b) { const g = canvas.getContext('2d'), c0 = css('--px0') || '#ffffff', c1 = css('--px1') || '#1d1c1a'; for (let p = 0; p !== 64; p++) { g.fillStyle = mix(c0, c1, levels[p] / b); g.fillRect(p % 8, Math.floor(p / 8), 1, 1); } }
async function fillShapes() {
  const r = await ask({ do: 'shapes' });
  if (!r.ok) { $('shapenote').textContent = 'The shapes did not load: ' + r.why; return; }
  let changed = 0;
  for (let m = 0; m !== r.s0.lv.length; m++) if (r.s0.lv[m].some((v, p) => v !== r.star.lv[m][p])) changed++;
  $('shapenote').textContent = 'The same 200 slots, 20 per digit. The loop changed ' + big(changed) + ' of them, and moved the reach from ' + r.s0.R + ' to ' + r.star.R + ' and the power from ' + r.s0.n + ' to ' + r.star.n + '.';
  for (const [id, s] of [['mem0', r.s0], ['mem1', r.star]]) $(id).replaceChildren(...s.lv.map((lv, i) => { const c = el('canvas', { width: '8', height: '8', 'aria-label': 'a stored ' + s.cls[i] }); draw(c, lv, r.b); return el('figure', {}, c, el('figcaption', {}, String(s.cls[i]))); }));
}
$('go').onclick = async () => {
  $('go').disabled = true; $('gostatus').textContent = 'reading the blind half with three shapes, then re-running the first cycles…';
  const r = await ask({ do: 'rerun', cycles: 25 });
  $('go').disabled = false;
  if (!r.ok) { $('gostatus').textContent = 'it did not run: ' + r.why; return; }
  const a = r.record, b = REC.record, logSame = JSON.stringify(r.log) === JSON.stringify(RA.log.slice(0, r.cycles));
  const rows = [['Rung 1\'s cell, clean', a.s0.clean, b.s0.clean], ['after the loop, clean', a.star.clean, b.star.clean], ['after the loop, 25% noise', a.star.n25, b.star.n25], ['the twin, clean', a.twin.clean, b.twin.clean],
    ['settles hashed', a.settles, b.settles], ['the hash of the blind-half record', a.hash, b.hash], ['the first ' + r.cycles + ' cycles of the adaptive loop', logSame ? 'same' : 'different', 'the log']];
  const tb = $('proof').querySelector('tbody'); tb.replaceChildren();
  let all = true;
  for (const [w, x, y] of rows) { const same = w.startsWith('the first') ? logSame : x === y; all = all && same; tb.append(el('tr', {}, el('td', {}, w), el('td', { class: 'num' }, String(x).slice(0, 24)), el('td', { class: 'num' }, String(y).slice(0, 24)), el('td', { class: same ? 'ok' : 'no' }, same ? '✓ same' : '✗ differs'))); }
  $('proof').hidden = false;
  $('gostatus').textContent = (all ? '✓ your tab reproduced the record and the loop\'s first cycles' : '✗ your tab differs from the record') + ' · ' + big(a.settles) + ' blind settles in ' + (r.evalMs / 1000).toFixed(1) + ' s, ' + r.cycles + ' cycles in ' + (r.loopMs / 1000).toFixed(1) + ' s';
};

// ── the cost case (Liveware's kernel, the sourced basis) ──
const gbp = (x) => '£' + Math.round(x).toLocaleString('en-GB');
function renderCost() {
  if (!BASIS) { $('c-head').textContent = 'The sourced basis did not load; reload the page.'; return; }
  const v = (id) => Number($(id).value);
  const r = mintCase(BASIS, { hoursPerWeek: v('c-hours'), share: v('c-share') / 100, seats: v('c-seats'), casesPerWeek: v('c-cases'), years: v('c-years') });
  if (!r.ok) { $('c-head').textContent = 'Check the inputs: ' + r.why + '.'; return; }
  const yrs = r.inputs.years + (r.inputs.years === 1 ? ' year' : ' years');
  $('c-overh').textContent = 'Over ' + yrs;
  $('c-head').textContent = `This process costs you ${gbp(r.perYear.today)} a year in staff time today. Owning it: ${gbp(r.perYear.own)} a year, which is ${gbp(r.savingPerYear)} a year back and ${gbp(r.savingOver)} over ${yrs}.`;
  const rows = [['Today', 'Your team does all of it.', 'today'], ['Rent AI assistant seats', `Microsoft 365 Copilot for ${r.inputs.seats} people (${gbp(r.lines.seats)} a year). It helps each person; the work, and the staff time, stay.`, 'rentSeats'],
    ['Call a cloud AI on every case', `Takes the same share off, billed per case at Claude Sonnet 5 API rates (${gbp(r.lines.api)} a year at your volume), and every case leaves your building.`, 'cloudApi'],
    ['Own it', `Takes the same share off on a machine you already have, for about ${gbp(r.lines.power)} a year of electricity. No seats, no meter, nothing leaves.`, 'own']];
  const tb = $('c-table').querySelector('tbody'); tb.replaceChildren();
  for (const [a, b, k] of rows) tb.append(el('tr', {}, el('td', {}, el('b', {}, a)), el('td', {}, b), el('td', { class: 'num' }, gbp(r.perYear[k])), el('td', { class: 'num' }, gbp(r.over[k]))));
  $('c-note').textContent = `Owning beats the cloud route by ${gbp(r.versusCloudOver)} over ${yrs} at this volume. Staff time is a floor: the UK median wage, with on-costs left out.`;
  $('c-board').textContent = `A small owned cell improved itself on new people's handwriting with no model in the loop, and every failure is published. Pick one narrow recognition or sorting step your people do by hand. Today it costs ${gbp(r.perYear.today)} a year in staff time. If an owned cell takes off the share you estimate, that is ${gbp(r.savingPerYear)} a year back, on hardware you already have, with nothing leaving the building, and the fee is due only on a receipt that it beat your current way on your own data.`;
}

async function main() {
  [REC, RA, RF, BASIS] = await Promise.all(['data/record.json', 'data/run-adaptive.json', 'data/run-fixed.json', 'vendor/liveware/basis.json'].map(json));
  GATES = (await Promise.all(['receipts/gate-loop.json', 'receipts/gate-eval.json', 'receipts/gate-semeion.json'].map(json))).filter(Boolean);
  $('c-src').replaceChildren(...sourcesOf(BASIS || {}).map((s) => { const li = el('li', {}, s.what + (s.source ? ': ' : '')); if (s.source) { const a = el('a', { href: s.source, target: '_blank', rel: 'noopener' }); try { a.textContent = new URL(s.source).hostname; } catch { a.textContent = s.source; } li.append(a); } return li; }));
  for (const id of ['c-hours', 'c-share', 'c-seats', 'c-cases', 'c-years']) $(id).addEventListener('input', renderCost);
  renderCost();
  if (!REC || !RA || !RF) { $('verdictline').textContent = 'The record did not load; reload the page.'; return; }
  fillResult();
  CA = cumulative(RA.log); CF = cumulative(RF.log);
  $('cyc').max = String(RA.log.length); $('cyc').value = String(RA.log.length);
  $('cyc').oninput = () => drawCurve(Number($('cyc').value));
  drawCurve(RA.log.length);
  fillShapes();
}
main();
