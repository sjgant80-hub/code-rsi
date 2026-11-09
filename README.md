# Code RSI

Live: **https://sjgant80-hub.github.io/code-rsi/**

Rung 2 of the geometric ladder: **model-free self-improvement.** Plain code proposes one small change at a time to Rung
1's settling cell, keeps it only if it wins on a fresh exam it has never seen, and retunes its own search from what it
measures. No model, no gradient, no network. Judged once on writers it never trained on.

## The result (UCI Semeion digits; the blind half, 797 digits, read once)

5 of the 6 measured claims held; 1 failed and is kept.

| | claim | measured |
|---|---|---|
| ✓ | R1 it improved itself on unseen writers | Rung 1's cell 18.7% → 69.6% clean (lower bound +47.2 points) |
| ✓ | R2 and under 25% noise | 7.0% → 60.0% (lower bound +49.4 points) |
| ✗ | R3 settling beats reading the same shape in one step | still not: 69.6% vs 72.6% clean |
| ✓ | R4 the recursive turn pays | adaptive 69.6% vs frozen-weights twin 67.9% clean (pooled lower bound +0.44 points) |
| ✓ | R6 the gate held both ways on every cycle | 140 changes kept by the adaptive run, 87 by the twin |
| ✓ | R9 every settle stopped | 0 unfinished |

Reference: storing all 796 tune digits and taking the nearest scores 90.6%. The evolved 200-pattern shape is well below
it.

## How it was kept honest

1. [`CLAIMS.md`](CLAIMS.md), seal 1 (3a4f0a1): the loop, the gate, the split, every seed and bar, before any code.
2. Both 1,500-cycle runs on the tune half only.
3. [`SEAL2.md`](SEAL2.md) (77bc2cb): both final shapes, the run logs and the code frozen by hash.
4. The blind half read once (`data/record.json`).

## Re-derive it

```bash
node --test test/loop.test.mjs test/eval.test.mjs test/page.test.mjs
node tools/loop.mjs --check
node tools/eval.mjs --check
```

Data: Semeion Handwritten Digit (Semeion Research Center, Rome; Tattile, Brescia), UCI, CC BY 4.0. Built on
[settling-cell](https://github.com/sjgant80-hub/settling-cell) (Rung 1), vendored byte for byte. Powered by the Konomi
architecture, created by Thomas Frumkin. MIT licence; credits in [`NOTICE`](NOTICE).
