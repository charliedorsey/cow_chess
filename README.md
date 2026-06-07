# 🐄 cow_chess 🐄 — browser play UI (Phase 1 MVP)

Play the cow in any browser. No server, no install — she runs entirely client-side via
WebAssembly. Static files only.

## Files
```
index.html       the page (branding, board, eval bar, controls, baby_elm modal)
app.js           the play UI (board, human input via chess.js, eval bar, sounds, controls)
cow-worker.js    Web Worker that drives the cow engine off the main thread
chess.js         legal-move validation / SAN / PGN (globalized, MIT)
cow.js           ← YOU ADD THIS: the Emscripten glue (the --public build)
cow.wasm         ← YOU ADD THIS: the cow engine (the --public build)
```

## Add the engine (one time, from your build)
Copy the **public** build you already made into this folder:
```bash
cp /path/to/cowwasm_2/engine/dist/cow.js  ./cow.js
cp /path/to/cowwasm_2/engine/dist/cow.wasm ./cow.wasm
```
(That's the `bash build_wasm.sh --public` output — telemetry stripped, id = cow_chess.)

## Run locally
The worker is an ES module and fetches `cow.wasm`, so you need a real server (not
`file://`). Any static server works:
```bash
cd cowsite
python3 -m http.server 8000
# open http://localhost:8000/
```

## Deploy (host-agnostic — pick any)
It's just static files. No backend, no special headers (she's single-threaded, so no
COOP/COEP needed).
- **GitHub Pages**: push this folder to a repo, enable Pages on the branch/root.
- **Netlify / Cloudflare Pages**: drag-and-drop the folder, or connect the repo.
- **itch.io**: zip the folder, upload as an HTML project, set `index.html` as the launch file.

Make sure the host serves `.wasm` as `application/wasm` (all of the above do by default).

## What works (v1)
- Click-to-move play vs the cow; legal moves dotted; auto-queen on promotion.
- Choose your color (cow takes the other; board auto-orients you at the bottom).
- Strength selector: **Casual** (depth 6 / ~1.2s) · **Club** (depth 10 / ~4s) ·
  **the ironclad cow** (full strength / ~15s). Default ironclad.
- Split-color **eval bar** driven by the cow's own score, with a 🐄/🧑 glyph showing who
  leads (cow on top, you on the bottom).
- Move list with **baby_elm** beside SAN, plus a baby_elm quick-reference (the “ⓘ be”
  button) and piece-identity-aware glyphs.
- New game · Take back · Export PGN · flip · sound · light/dark (remembers theme).

## To ship a future version of her
Rebuild the engine (`bash build_wasm.sh --public`) and replace `cow.js` + `cow.wasm`.
Bump the version note in `index.html` if you like. Redeploy = re-push the static files.

## Notes
- The eval shown is the **cow's** evaluation (not Stockfish). It updates each time she
  finishes a search.
- v1 ships full play; “her top 2–3 moves” (MultiPV) and the “show her mind” telemetry
  reveal are deliberate future features.
