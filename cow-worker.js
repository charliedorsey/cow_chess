// cow-worker.js — runs the cow (WASM) off the main thread.
// Protocol:
//   main -> worker: {type:'init'} | {type:'cmd', cmd:'<uci line>'}
//   worker -> main: {type:'ready'} | {type:'line', line:'<engine stdout line>'}
//                   {type:'bestmove', move:'e2e4', uci:'<full line>'}
// The engine's stdout is captured line-by-line via the Emscripten print hook.
// A `go` runs synchronously inside cow_uci here in the worker (blocks the worker,
// not the page); when it returns, the bestmove line has already been emitted.

// ── CACHE-BUSTING ──────────────────────────────────────────────────────────
//  GitHub Pages (and the browser) cache cow.js and cow.wasm INDEPENDENTLY.
//  A fresh cow.js paired with a stale cached cow.wasm (or vice versa) loads
//  fine but crashes on the first search ("memory access out of bounds"),
//  because the two builds' memory/function layouts don't match.
//  The ?v=N query forces a fresh, MATCHED pair. **Bump N on every deploy**,
//  and keep it identical in BOTH places below (the import AND locateFile).
import CowModule from './cow.js?v=362bf99b7827';
const COW_WASM_V = '362bf99b7827';   // <-- must match the ?v= in the import line above

// ─────────────────────────────────────────────────────────────────────────
//  HER PLAYING CONFIG  —  the one place to change how she plays.
//
//  Current arm:   instab + b15 + vision + kingpen + cowpawnchain
//
//  Each entry is a UCI setoption line, sent once at startup (after `uci`).
//  Changing this is PURE JS: edit, save, re-push the site — NO wasm rebuild
//  needed. You only rebuild cow.js/cow.wasm when the ENGINE SOURCE changes.
//  To try another arm, comment a line out or change a value and re-push.
// ─────────────────────────────────────────────────────────────────────────
const COW_CONFIG = [
  'setoption name CowPredictiveCutInstability value true', // instab  — keep deepening while her best move is unsettled
  'setoption name CowTimeBudgetBonusPct value 15',         // b15     — +15% per-move time budget (timed modes)
  'setoption name CowVisionTotalOrder value true',         // vision  — total-vision move ordering
  'setoption name CowKingVisionPenalty value true',        // kingpen — king-vision penalty (needs vision on)
  'setoption name CowPawnChain value true',                // cowpawnchain — pawn-chain reward (Candidate; remove to revert)
];

let Module = null;
let cow_uci = null;
let cow_init = null;

function emit(line) {
  postMessage({ type: 'line', line });
  if (line.startsWith('bestmove')) {
    const m = line.match(/^bestmove\s+(\S+)/);
    postMessage({ type: 'bestmove', move: m ? m[1] : null, uci: line });
  }
}

(async () => {
  try {
    Module = await CowModule({
      print: emit,
      printErr: () => {},   // engine is quiet on stderr
      // Force cow.wasm to carry the SAME version as cow.js so the browser/CDN
      // can never serve a mismatched (stale-wasm / fresh-js) pair.
      locateFile: (path) => path + '?v=' + COW_WASM_V,
    });
    cow_uci  = Module.cwrap('cow_uci',  'number', ['string']);
    cow_init = Module.cwrap('cow_init', null, []);
    cow_init();
    cow_uci('uci');
    for (const line of COW_CONFIG) cow_uci(line);   // apply her playing arm
    cow_uci('isready');
    postMessage({ type: 'ready' });
  } catch (err) {
    postMessage({ type: 'error', message: String(err) });
  }
})();

onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'cmd' && cow_uci) {
    // Each command is one UCI line. `go ...` blocks here until bestmove — fine in a worker.
    cow_uci(msg.cmd);
  }
};
