// src/semeion.mjs — the Semeion handwritten digits as the settling cell's 8×8 ink grid, and the sealed split.
// Each 2×2 block of the 16×16 black-and-white image counts 0..4 on-pixels; times 4 that is ink 0..16, so under the
// cell's 4-bit thermometer code the bits are exactly the count. Pure; a malformed line is counted, never thrown.
// Sealed first: CLAIMS.md (seal 1, 3a4f0a1).
export const SIDE = 16, GRID = 8, CLASSES = 10, SPLIT = 796;
const PIX = /^(0|1)(\.0+)?$/;

/** parse(text) → { x: 64 ink counts (0..16) per digit, y: its class, bad: malformed lines }. */
export function parse(text) {
  const x = [], y = [];
  let bad = 0;
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const f = line.split(/\s+/);
    if (f.length !== SIDE * SIDE + CLASSES || !f.every((v) => PIX.test(v))) { bad++; continue; }
    const on = f.map((v) => v.charAt(0) === '1');
    const hot = on.slice(SIDE * SIDE);
    if (hot.filter(Boolean).length !== 1) { bad++; continue; }
    const ink = new Array(GRID * GRID).fill(0);
    for (let r = 0; r !== SIDE; r++) for (let c = 0; c !== SIDE; c++) if (on[r * SIDE + c]) ink[(r >> 1) * GRID + (c >> 1)] += 4;
    x.push(ink);
    y.push(hot.indexOf(true));
  }
  return { x, y, bad };
}

/** halves(d) → the sealed split: T = rows before SPLIT (the loop's only data), V = the rest (read once, after seal 2). */
export function halves(d) {
  return { T: { x: d.x.slice(0, SPLIT), y: d.y.slice(0, SPLIT) }, V: { x: d.x.slice(SPLIT), y: d.y.slice(SPLIT) } };
}

export default { SIDE, GRID, CLASSES, SPLIT, parse, halves };
