# Seal 2 · both final shapes frozen, before the blind half is read

Committed after seal 1 (`CLAIMS.md`, 3a4f0a1). The loop code was only ever handed the tune half T (Semeion rows
0–795); `tools/loop.mjs` slices T before calling it. **No code has read the blind half V (rows 796–1592) for any
result.** The next commit runs `tools/eval.mjs` once, which refuses to run unless this file names both shapes below.

## The final shapes

| run | final shape | sha256 | changes kept | final weights (nudge, reseed, blend, push, reach, power) |
|---|---|---|---|---|
| adaptive | `data/cell-adaptive.txt` (R=80, n=6) | 79007f139e93d4df52d0dd153fb3e404db745d78611e8089fc2fc1ecfa5adbdf | 140 of 1,500 | 7, 94, 15, 10, 429, 85 |
| twin, frozen weights | `data/cell-fixed.txt` (R=80, n=7) | a8d1dcb674b1bc9855b85c7a8317d7a1cc78d102fe52cefca3ae1611f96e6f24 | 87 of 1,500 | 100 each |

Run log hashes: adaptive `399a0fcc25da47816cadd9a8980b89451906b2057e569de32b82bfe28aa33ea3`, twin
`a0cdd78949d80092f7a1ec731f1fe55504dbfaeec2989231f12c24c6ef1e157e`. Both runs re-derive byte for byte with the code
below (`node tools/loop.mjs --check`).

## The code, frozen here

| file | sha256 | mutation gate (witness v0.6) |
|---|---|---|
| `src/semeion.mjs` | eb1f6bf2b9da1d260f00c213ac91e1897da37b32137769e37970962925c9b66b | 7 of 7 caught, 0 baselined |
| `src/loop.mjs` | 1d8c84ebb21bc6108d6127875b493a74c2fc79045afb23d6c80793dcc9f43053 | 62 of 62 caught, 0 baselined |
| `src/eval.mjs` | add0c13b80d19b437a8589a63338df92a0bcac741801d9cc81725277f1b4907b | 22 of 22 caught, 0 baselined |

One thing seen on the tune side, recorded before the blind half: the adaptive run kept 80 `reach` changes, but R only
moved from 64 to 80 in net. Reach went back and forth, so some of those keeps are likely noise that cleared the gate on
its batch. The blind half is the only judge of whether the shape improved.
