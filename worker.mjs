// worker.mjs — the loop and the evaluator, off the page's thread. It loads the committed files from this site and answers:
//   'rerun'  → src/eval.mjs's evaluate on the three frozen shapes (the blind-half record and its hash, claim R8), then the
//              first cycles of the adaptive loop re-run from Rung 1's cell, to compare with the committed log
//   'shapes' → the patterns of Rung 1's cell and of the loop's final shape, for drawing
import S from './src/semeion.mjs';
import L from './src/loop.mjs';
import E from './src/eval.mjs';

const get = (p) => fetch(new URL(p, import.meta.url)).then((r) => { if (!r.ok) throw new Error(p + ' answered ' + r.status); return r.text(); });
let files = null;
async function load() {
  if (files) return files;
  const [semText, s0Text, adaptiveText, fixedText, runA, runF] = await Promise.all(['./data/semeion.data', './vendor/settling-cell/data/cell.txt', './data/cell-adaptive.txt', './data/cell-fixed.txt', './data/run-adaptive.json', './data/run-fixed.json'].map(get));
  files = { semText, s0Text, adaptiveText, fixedText, adaptiveLog: JSON.parse(runA).log, fixedLog: JSON.parse(runF).log };
  return files;
}

self.onmessage = async (m) => {
  const q = m.data || {};
  try {
    const f = await load();
    if (q.do === 'rerun') {
      let t = performance.now();
      const record = E.evaluate(f);
      const evalMs = Math.round(performance.now() - t);
      t = performance.now();
      const cycles = Math.max(1, Math.min(200, q.cycles | 0));
      const { T } = S.halves(S.parse(f.semText));
      const head = L.runLoop(T, f.s0Text, { cycles });
      self.postMessage({ id: q.id, ok: !!record && !!head, record, evalMs, loopMs: Math.round(performance.now() - t), cycles, log: head && head.log, why: record ? '' : 'the record did not compute' });
      return;
    }
    if (q.do === 'shapes') {
      const a = L.levelsShape(f.s0Text), b = L.levelsShape(f.adaptiveText);
      self.postMessage({ id: q.id, ok: true, b: a.b, s0: { lv: a.lv, cls: a.cls, R: a.R, n: a.n }, star: { lv: b.lv, cls: b.cls, R: b.R, n: b.n } });
      return;
    }
    self.postMessage({ id: q.id, ok: false, why: 'unknown request' });
  } catch (e) { self.postMessage({ id: q.id, ok: false, why: String((e && e.message) || e).slice(0, 200) }); }
};
