// The page and the files, held to their sealed claims: R10 (no measured number typed into the page), R11 (the data and the
// vendored Rung 1 files are the pinned bytes), seal 2 naming the final shapes, the credits, and the failures told.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const sha = (p) => createHash('sha256').update(readFileSync(new URL(p, ROOT))).digest('hex');
const html = read('index.html'), app = read('app.mjs'), claims = read('CLAIMS.md');

test('R11: Semeion and the vendored Rung 1 files are the bytes seal 1 pinned', () => {
  assert.ok(claims.includes(sha('data/semeion.data')), 'semeion.data is pinned in CLAIMS.md');
  assert.ok(claims.includes(sha('vendor/settling-cell/data/cell.txt')));
  assert.ok(claims.includes(sha('vendor/settling-cell/src/cell.mjs')));
  const pinned = new Map();
  for (const s of JSON.parse(read('vendor/SOURCES.json')).sources) for (const f of s.files) pinned.set(f.path, f.sha256);
  const files = [];
  (function walk(d) { for (const n of readdirSync(new URL(d, ROOT))) { const p = d + '/' + n; if (statSync(new URL(p, ROOT)).isDirectory()) walk(p); else files.push(p); } })('vendor');
  for (const f of files.filter((x) => x !== 'vendor/SOURCES.json')) { assert.ok(pinned.has(f), f + ' is not pinned'); assert.equal(sha(f), pinned.get(f), f + ' changed'); }
  assert.equal(pinned.size, 6);
});

test('seal 2 names both final shapes, and the record is built from them', () => {
  const seal = read('SEAL2.md'), r = JSON.parse(read('data/record.json'));
  for (const f of ['data/cell-adaptive.txt', 'data/cell-fixed.txt']) assert.ok(seal.includes(sha(f)), f);
  assert.equal(r.record.hashes.star, sha('data/cell-adaptive.txt'));
  assert.equal(r.record.hashes.twin, sha('data/cell-fixed.txt'));
  assert.equal(r.record.hashes.s0, sha('vendor/settling-cell/data/cell.txt'));
  assert.equal(r.runs.adaptive, JSON.parse(read('data/run-adaptive.json')).hash);
  assert.equal(r.runs.fixed, JSON.parse(read('data/run-fixed.json')).hash);
});

test('R10: no measured number is typed into the page', () => {
  const r = JSON.parse(read('data/record.json')).record, ra = JSON.parse(read('data/run-adaptive.json')), rf = JSON.parse(read('data/run-fixed.json'));
  const forms = new Set();
  const frac = (v) => { if (typeof v !== 'number' || !Number.isFinite(v)) return; if (v !== 0 && v !== 1) forms.add(String(v)); forms.add((v * 100).toFixed(1) + '%'); forms.add(Math.abs(v * 100).toFixed(2) + ' points'); };
  for (const k of ['s0', 'star', 'twin']) for (const v of Object.values(r[k])) frac(v);
  frac(r.nnTune);
  for (const v of Object.values(r.lows)) frac(v);
  for (const n of [r.accepted.adaptive, r.accepted.fixed, ra.accepted, rf.accepted, r.settles]) { forms.add(n + ' of'); forms.add(n.toLocaleString('en-GB') + ' settles'); }
  forms.add(r.hash.slice(0, 12)); forms.add(ra.hash.slice(0, 12)); forms.add(rf.hash.slice(0, 12));
  for (const w of ra.weights) forms.add('weight ' + w);
  const visible = html.replace(/<style>[\s\S]*?<\/style>/, '');
  for (const s of forms) assert.equal(visible.includes(s), false, 'the page has "' + s + '" typed in; it must come from the record');
  assert.match(app, /pct\(r\.star\.clean\)/, 'the numbers are rendered from the record');
});

test('the failures are told, the page explains itself, talks only to itself, and carries its credits', () => {
  assert.match(app, /pass \? 'HELD' : 'FAILED'/);
  assert.match(app, /Failed and kept: /);
  assert.match(app, /Each failure is kept on the record and on this page\./);
  assert.match(html, /A claim that misses its bar is kept and shown as failed\./);
  for (const id of ['result', 'evolve', 'shapes', 'rerun', 'what', 'start', 'how', 'blueprint', 'adoption', 'paper', 'business']) assert.match(html, new RegExp('<section id="' + id + '"'), id);
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /Semeion Handwritten Digit, Semeion Research Center of Sciences of Communication, Rome, and Tattile, Brescia; UCI Machine Learning Repository, CC BY 4\.0\./);
  assert.match(html, /Hopfield \(1982\) and Krotov &amp; Hopfield \(2016\)/);
  assert.match(html, /Powered by the Konomi architecture, created by Thomas Frumkin/);
  assert.equal(/£\s?\d|\$\s?\d|per seat|\/mo\b/i.test(html), false, 'no price of ours on the page');
});
