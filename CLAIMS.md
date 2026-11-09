# code-rsi · sealed claims (seal 1, before any code)

Rung 2 of the geometric substrate ladder: **model-free self-improvement. Code evolves the shape, with fresh exams each
cycle, and the loop turns on itself.** This file is committed alone, before a line of code. Every bar is fixed here. A
claim that misses its bar is kept and published as failed.

## Where it starts and what it must fix

- **The starting shape S0** is Rung 1's frozen cell, vendored byte for byte from sjgant80-hub/settling-cell
  (`vendor/settling-cell/data/cell.txt`, sha256 `095d33a8bb6d6393173b48279f60000aa2d9e3b1413abc2e18e87936dab73b88`;
  kernel `src/cell.mjs`, sha256 `590c8307b06148dbfa7c2e4a247336441e150d8235d62783c45efb53190d9101`). 200 patterns of 256
  bits, reach 64, power 6, grown on the UCI optical digits.
- **What Rung 1 left open:** its claim T7 failed. Settling scored lower than reading the same shape in one step.

## The new data, never seen by Rung 1

- UCI *Semeion Handwritten Digit* (Semeion Research Center of Sciences of Communication, Rome, and Tattile, Brescia;
  CC BY 4.0): 1,593 digits from about 80 people, 16×16 black-and-white pixels.
  `semeion.data` sha256 `f43228ae3da5ea6a3c95069d53450b86166770e3b719dcc333182128fe08d4b1`.
- **Conversion:** each 2×2 block of the 16×16 image gives a count of 0 to 4 on-pixels; times 4, that is the cell's
  8×8 ink grid of 0..16. Under the cell's 4-bit thermometer code the bits are exactly that count.
- **Split:** the file is in blocks of about 200 rows (about 20 of each digit, which suggests about 10 writers per
  block). The split falls on the block boundary at row 796. **T** (tune) = rows 0–795 (796 digits). **V** (blind) =
  rows 796–1592 (797 digits). The dataset does not document writer IDs, so writer-disjoint halves are likely, not
  proven. The dataset's own notes recommend 50% tune and a completely blind 50% validation.
- **V is read once,** after the loop's final shapes are frozen by hash (seal 2). The loop never sees a V row.

## The loop (model-free: no model, no gradient, no network)

- **State:** the current shape S (patterns as 8×8 levels 0..4, reach R, power n) and an integer weight per operator.
- **Each cycle t:** choose an operator by weight (the seeded estate rng), propose S' from S, then draw a **fresh exam
  batch** of 100 items from T. An item is a T digit with 6 of its 64 pixels (10%) replaced by fresh seeded noise; every
  item's noise seed is used exactly once. Settle S and S' on every item.
- **The gate:** accept S' only if (items S' gets right and S gets wrong) − (items S gets right and S' gets wrong) ≥ 2.
  A proposal whose energy would leave the exact whole-number range is refused unexamined.
- **Operators:** *nudge* (one pixel of one pattern, ±1 level); *reseed* (replace a pattern with a digit the current
  shape got wrong in the previous batch, as that digit's class); *blend* (move 8 pixels of the right class's nearest
  pattern to a previous error's levels); *push* (move 8 pixels of the wrongly winning class's nearest pattern one level
  away from that error); *reach* (R ± 4); *power* (n ± 1, within 2..8). The previous batch informs proposals; the gate
  always uses the next, fresh batch.
- **The recursive turn:** the loop rewrites its own proposal mix from measured results. An operator's weight starts at
  100, gains 10 when its proposal is accepted (to at most 1,000) and loses 1 when rejected (to at least 1).
- **The twin:** the same loop with weights frozen at 100, the same seeds and the same exam stream. It is the control
  for the recursive turn.
- **Budget:** 1,500 cycles each. Seeds: the loop's rng 4242; exam order 777; exam noise seed 50,000 + the item's
  position in the stream; the bootstrap 2,000 resamples, seed 99, lower bound = the 2.5th percentile.

## The claims (on V, the blind half, read once)

- **R1 · it improved itself, on writers it never trained on.** The adaptive loop's final shape S* beats S0 settling
  clean V digits: paired 95% lower bound > 0.
- **R2 · and under noise.** S* beats S0 with 25% of the pixels replaced (16 of 64, seed 2026 + the row): lower bound > 0.
- **R3 · settling earns its keep (Rung 1's T7, retaken).** S* settling beats S* read in one step at 25% noise: lower
  bound > 0. Clean, settling is not worse than one step by more than 0.5 points: lower bound > −0.5 points.
- **R4 · the recursive turn pays.** S* beats the twin's final shape, pooled over clean and 25% noise V items: lower
  bound > 0.
- **R5 · fresh exams.** Over each whole run, no exam item's noise seed repeats, and no exam item is a V row.
- **R6 · every change earned its place.** Every accepted change cleared the gate on its own fresh batch.
- **R7 · model-free.** The loop's code imports only the vendored cell kernel, the vendored rng and SHA-256, and this
  repository's own data code. It makes no network call and loads no weights.
- **R8 · deterministic.** Each run's full log (every cycle's operator, verdict, wins and losses) has one SHA-256: two
  runs agree, GitHub's runner agrees, and the page re-runs the first cycles in a tab and matches.
- **R9 · bounded.** Every accepted shape builds an exact whole-number cell, and every settle in the runs and on V stops.
- **R10 · the page.** No measured number is typed into `index.html`.
- **R11 · the data.** Semeion and the vendored Rung 1 files are byte-identical to the hashes above.
- **G · the gate.** witness v0.6 on this repository's kernels: CLEAN, nothing baselined. CI green on GitHub's runner.

## What Rung 2 is not

Not a hybrid with step-code (Rung 3), not shared across a mesh (Rung 4), not a defence (Rung 5), not on a chip
(Rung 7). It proves only what is listed above.
