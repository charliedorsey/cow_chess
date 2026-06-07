// cow-worker.js — runs the cow (WASM) off the main thread.
// Protocol:
//   main -> worker: {type:'init'} | {type:'cmd', cmd:'<uci line>'}
//   worker -> main: {type:'ready'} | {type:'line', line:'<engine stdout line>'}
//                   {type:'bestmove', move:'e2e4', uci:'<full line>'}
// The engine's stdout is captured line-by-line via the Emscripten print hook.
// A `go` runs synchronously inside cow_uci here in the worker (blocks the worker,
// not the page); when it returns, the bestmove line has already been emitted.

import CowModule from './cow.js';

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
    });
    cow_uci  = Module.cwrap('cow_uci',  'number', ['string']);
    cow_init = Module.cwrap('cow_init', null, []);
    cow_init();
    // standard handshake so the UI knows she's up
    cow_uci('uci');
    // Tuned config — the cow's default playing setup (= match-runner arm
    // `instab+b20+kingpen+vision`). instab: keep deepening while her best move is
    // unsettled. b20: +20% per-move time budget (timed modes). vision: total-vision
    // move ordering. kingpen: king-vision penalty modifier (needs vision on).
    cow_uci('setoption name CowPredictiveCutInstability value true');
    cow_uci('setoption name CowTimeBudgetBonusPct value 20');
    cow_uci('setoption name CowVisionTotalOrder value true');
    cow_uci('setoption name CowKingVisionPenalty value true');
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
