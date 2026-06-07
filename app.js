// app.js — 🐄 cow_chess 🐄 — play against the cow in your browser.
// Board/glide/themes/sounds adapted from the game watcher; engine via cow-worker.js.

const $ = id => document.getElementById(id);
const PIECE = {p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};

// ── baby_elm chess notation (faithful port of babyelm_translate.render_move) ──
const BE = {"squares":{"a1":"⠉","a2":"⠙","a3":"⠹","a4":"⢹","a5":"⢱","a6":"⢡","a7":"⢁","a8":"⢉","b1":"⠋","b2":"⠛","b3":"⠻","b4":"⢻","b5":"⢳","b6":"⢣","b7":"⢃","b8":"⢋","c1":"⠏","c2":"⠟","c3":"⠿","c4":"⢿","c5":"⢷","c6":"⢧","c7":"⢇","c8":"⢏","d1":"⡏","d2":"⡟","d3":"⡿","d4":"⣿","d5":"⣷","d6":"⣧","d7":"⣇","d8":"⣏","e1":"⡎","e2":"⡞","e3":"⡾","e4":"⣾","e5":"⣶","e6":"⣦","e7":"⣆","e8":"⣎","f1":"⡌","f2":"⡜","f3":"⡼","f4":"⣼","f5":"⣴","f6":"⣤","f7":"⣄","f8":"⣌","g1":"⡈","g2":"⡘","g3":"⡸","g4":"⣸","g5":"⣰","g6":"⣠","g7":"⣀","g8":"⣈","h1":"⡉","h2":"⡙","h3":"⡹","h4":"⣹","h5":"⣱","h6":"⣡","h7":"⣁","h8":"⣉"},
  "white":{"K":"♔","Q":"♕","R_a":"♖","R_h":"🨠","B_dark":"♗","B_light":"🨡","N_b":"♘","N_g":"🨢","P":"♙"},
  "black":{"K":"♚","Q":"♛","R_a":"♜","R_h":"🨦","B_dark":"♝","B_light":"🨧","N_b":"♞","N_g":"🨨","P":"♟"},
  "promo":{"w":{"q":["🩎","🨟","🨊","🨴"],"r":["🨋","🨵","🨗","🩁"],"b":["🨌","🨶","🨘","🩂"],"n":["🨍","🨷","🨙","🩃"]},
           "b":{"q":["🩑","🨥","🨐","🨺"],"r":["🨋","🨵","🨗","🩁"],"b":["🨌","🨶","🨘","🩂"],"n":["🨍","🨷","🨙","🩃"]}},
  "punct":{"capture":"✶","check":"†","checkmate":"☠"}};
function BeTranslator(){
  const at={}; const W=BE.white,Bk=BE.black;
  const back={a:'R_a',b:'N_b',c:'B_dark',d:'Q',e:'K',f:'B_light',g:'N_g',h:'R_h'};
  for(const f of 'abcdefgh'){ at[f+'1']=W[back[f]]; at[f+'8']=Bk[back[f]]; at[f+'2']=W.P; at[f+'7']=Bk.P; }
  const pc={w:{q:0,r:0,b:0,n:0},b:{q:0,r:0,b:0,n:0}};
  function promoGlyph(side,t){ const arr=BE.promo[side][t]||BE.promo[side].q; const i=pc[side][t]++; return arr[Math.min(i,arr.length-1)]; }
  return function render(mv){
    const side=mv.color, pieceGlyph=at[mv.from]||'?', dest=BE.squares[mv.to]||'';
    let suffix=''; if(/#/.test(mv.san))suffix=BE.punct.checkmate; else if(/\+/.test(mv.san))suffix=BE.punct.check;
    let g=at[mv.from]; delete at[mv.from];
    if(mv.promotion) g=promoGlyph(side,mv.promotion);
    at[mv.to]=g;
    if(mv.piece==='k' && /[kq]/.test(mv.flags)){ const r=side==='w'?'1':'8';
      if(mv.flags.includes('k')){ at['f'+r]=at['h'+r]; delete at['h'+r]; } else { at['d'+r]=at['a'+r]; delete at['a'+r]; } }
    return pieceGlyph+(/x/.test(mv.san)?BE.punct.capture:'')+dest+suffix;
  };
}

// ── engine worker ──
let worker=null, engineReady=false, thinking=false;
let pendingResolve=null, lastInfo=null;
function startWorker(){
  worker=new Worker('cow-worker.js',{type:'module'});
  worker.onmessage=(e)=>{
    const m=e.data;
    if(m.type==='ready'){ engineReady=true; setStatus('the cow is ready 🐄'); dbg('[ready]'); }
    else if(m.type==='line'){ dbg('« '+m.line); const mi=m.line.match(/score (cp|mate) (-?\d+)/); if(mi){ lastInfo={kind:mi[1],val:+mi[2],line:m.line}; } }
    else if(m.type==='bestmove'){ thinking=false; dbg('[bestmove='+m.move+']'); if(pendingResolve){ const r=pendingResolve; pendingResolve=null; r(m.move); } }
    else if(m.type==='error'){ setStatus('⚠ engine failed to load — is cow.js / cow.wasm in this folder?'); dbg('[ERROR] '+(m.message||'')); }
  };
  worker.onerror=()=>{ setStatus('⚠ engine failed to load — is cow.js / cow.wasm in this folder?'); $('thinkdot').classList.remove('on'); };
}
function send(cmd){ dbg('» '+cmd); worker.postMessage({type:'cmd',cmd}); }
let _dbgOn=false, _dbgLines=[];
function dbg(s){ _dbgLines.push(s); if(_dbgLines.length>200)_dbgLines.shift(); const el=$('dbg'); if(el){ el.textContent=_dbgLines.join('\n'); el.scrollTop=el.scrollHeight; } }
function engineGo(){ return new Promise(res=>{ pendingResolve=res; thinking=true;
  const moves=game.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||'')).join(' ');
  send('position startpos'+(moves?(' moves '+moves):''));
  const d=DIFFS[difficulty]||DIFFS.t5;
  if(d.group==='depth'){
    send('go depth '+d.depth);
  } else {
    // Cow tournament clock. UCI wants wtime/btime per color; only the cow has a managed
    // clock (you move at your leisure in v1), so we give YOU a big constant so she never
    // thinks you're about to flag, and feed HER real remaining time on her own color.
    const HUGE=3600000;
    const cowIsWhite = (cowColor==='w');
    const wtime = cowIsWhite ? cowClockMs : HUGE;
    const btime = cowIsWhite ? HUGE : cowClockMs;
    send(`go wtime ${Math.max(1,Math.round(wtime))} btime ${Math.max(1,Math.round(btime))} winc ${d.inc} binc ${d.inc}`);
    _goStart=performance.now();   // to measure how long she actually thinks
  }
}); }
let _goStart=0;

// ── game state ──
const game=new Chess();
let cowColor='b';            // cow plays black by default (you're white)
let flip=false;              // board orientation; you're always at the bottom
let plies=[];                // {san, be, from, to, fen}
let viewPly=0;               // for review nav; equals plies.length during live play
let be=BeTranslator();
let lastEval=null;           // {kind,val} from cow's POV-agnostic (white-rel) — we normalize

// ── difficulty ──
// Two families:
//   timed  → the cow runs a real tournament clock (we send `go wtime/btime/winc/binc`
//            and let HER clock management decide how long to think). v1 = cow-only budget:
//            we track only her remaining time; you move at your leisure. base = minutes,
//            inc = seconds added after each of her moves.
//   depth  → fixed `go depth N` (raw ply/iteration count; depth 1 is near-random,
//            depth 10 is strong-but-slow).
const DIFFS={
  // timed (cow tournament-clock management)
  t3:  {group:'timed', label:'3 min · cow tournament (+2s)',  base:180000, inc:2000},
  t5:  {group:'timed', label:'5 min · cow tournament (+3s)',  base:300000, inc:3000},
  t10: {group:'timed', label:'10 min · cow tournament (+5s)', base:600000, inc:5000},
  // fixed depth
  d1:  {group:'depth', label:'easy · 1 ply',      depth:1},
  d3:  {group:'depth', label:'casual · 3 ply',    depth:3},
  d5:  {group:'depth', label:'club · 5 ply',      depth:5},
  d10: {group:'depth', label:'the ironclad cow · 10 ply (slow!)', depth:10},
};
let difficulty='t5';           // default: cow tournament mode, 5-minute, full strength
let cowClockMs=300000;         // cow's remaining time (timed modes); reset on new game

// ── board render (flip-aware, coords, last-move highlight, glide) ──
function sqXY(sqName){const file='abcdefgh'.indexOf(sqName[0]); const rank=+sqName[1]; return flip?{col:7-file,row:rank-1}:{col:file,row:8-rank};}
function idxSquare(i){const col=i%8,row=Math.floor(i/8); const file=flip?7-col:col; const rank=flip?row+1:8-row; return {file,rank,name:'abcdefgh'[file]+rank};}
function fenCells(fen){const cells=[];for(const r of fen.split(' ')[0].split('/'))for(const ch of r){if(/\d/.test(ch)){for(let k=0;k<+ch;k++)cells.push('');}else cells.push(ch);}return cells;}
let selected=null, legalTargets=[];
function drawBoard(anim){
  const fen=game.fen(); const raw=fenCells(fen); const cells=flip?raw.slice().reverse():raw;
  const hist=game.history({verbose:true}); const last=hist.length?hist[hist.length-1]:null;
  const b=$('board'); b.innerHTML='';
  for(let i=0;i<64;i++){const col=i%8,row=Math.floor(i/8);const sq=document.createElement('div');
    sq.className='sq '+(((col+row)%2)?'d':'l');
    const info=idxSquare(i);
    if(last){ if(info.name===last.from)sq.classList.add('lastf'); if(info.name===last.to)sq.classList.add('lastt'); }
    if(selected===info.name)sq.classList.add('sel');
    if(legalTargets.includes(info.name)){ sq.classList.add('legal'); if(cells[i])sq.classList.add('cap'); }
    const c=cells[i];
    if(c){const w=c===c.toUpperCase();sq.innerHTML=`<span class="pc ${w?'w':'b'}">${PIECE[c.toLowerCase()]}</span>`;}
    if(row===7)sq.insertAdjacentHTML('beforeend',`<span class="coord f">${'abcdefgh'[info.file]}</span>`);
    if(col===0)sq.insertAdjacentHTML('beforeend',`<span class="coord r">${info.rank}</span>`);
    sq.dataset.sq=info.name;
    sq.onclick=()=>onSquare(info.name);
    b.appendChild(sq);}
  if(anim&&last&&b.clientWidth){
    const d=sqXY(last.to); const idx=d.row*8+d.col; const cell=b.children[idx]; const pcSpan=cell&&cell.querySelector('.pc');
    if(pcSpan){ pcSpan.style.opacity='0'; glide(last.from,last.to,pcSpan.outerHTML,()=>{pcSpan.style.opacity='1';}); }
  }
}
let _glideFin=null;
function glide(fromSq,toSq,html,onEnd){
  if(_glideFin)_glideFin();
  const b=$('board'); const sz=b.clientWidth/8; const a=sqXY(fromSq),z=sqXY(toSq);
  const f=document.createElement('div'); f.className='floatpc'; f.innerHTML=html;
  f.style.left=(a.col*sz)+'px'; f.style.top=(a.row*sz)+'px'; b.appendChild(f);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ f.style.transform=`translate(${(z.col-a.col)*sz}px,${(z.row-a.row)*sz}px)`; }));
  let done=false; const fin=()=>{if(done)return;done=true;if(_glideFin===fin)_glideFin=null;onEnd&&onEnd();f.remove();};
  _glideFin=fin; f.addEventListener('transitionend',fin,{once:true}); setTimeout(fin,260);
}

// ── human input (click-to-move) ──
function onSquare(name){
  if(thinking || game.game_over()) return;
  if(game.turn()===cowColor) return;            // not your turn
  const piece=game.get(name);
  if(selected){
    if(name===selected){ selected=null; legalTargets=[]; drawBoard(); return; }
    // try the move (auto-queen on promotion for v1)
    const mv=tryMove(selected,name);
    if(mv){ selected=null; legalTargets=[]; afterHumanMove(mv); return; }
    // re-select if clicked own piece
    if(piece && piece.color===game.turn()){ select(name); return; }
    selected=null; legalTargets=[]; drawBoard(); return;
  }
  if(piece && piece.color===game.turn()) select(name);
}
function select(name){ selected=name; legalTargets=game.moves({square:name,verbose:true}).map(m=>m.to); drawBoard(); }
function tryMove(from,to){
  const moves=game.moves({verbose:true}).filter(m=>m.from===from&&m.to===to);
  if(!moves.length) return null;
  let promo=undefined;
  if(moves.some(m=>m.promotion)) promo='q';     // v1: auto-queen
  return game.move({from,to,promotion:promo});
}
function afterHumanMove(mv){ recordMove(mv,'you'); drawBoard(true); sound(mv); updateAfterMove();
  if(!game.game_over()) setTimeout(cowTurn, 220); }
async function cowTurn(){
  if(game.game_over()) return;
  const d=DIFFS[difficulty]||DIFFS.t5;
  setStatus('the cow is thinking… 🐄'); $('thinkdot').classList.add('on');
  const uci=await engineGo();
  $('thinkdot').classList.remove('on');
  // Timed modes: charge the cow for the time she actually used, then add the increment.
  if(d.group==='timed'){
    const used=performance.now()-_goStart;
    cowClockMs=cowClockMs-used+d.inc;
    if(cowClockMs<=0){ cowClockMs=0; updateClock(); setStatus('the cow flagged — you win on time! 🎉'); return; }
    updateClock();
  }
  if(!uci || uci==='0000' || uci==='(none)'){
    if(game.game_over()){ updateAfterMove(); }
    else { setStatus('⚠ the cow had no move to make (got '+(uci||'nothing')+')'); }
    return;
  }
  const from=uci.slice(0,2), to=uci.slice(2,4), promo=uci.slice(4,5);
  const arg = promo ? {from,to,promotion:promo} : {from,to};
  const mv=game.move(arg);
  if(!mv){ setStatus('⚠ the cow returned a move I could not apply: '+uci); return; }
  recordMove(mv,'cow'); drawBoard(true); sound(mv);
  updateAfterMove(); if(!game.game_over()) setStatus('your move');
}
function fmtClock(ms){ const s=Math.max(0,Math.ceil(ms/1000)); const m=Math.floor(s/60); const r=s%60; return m+':'+String(r).padStart(2,'0'); }
function updateClock(){ const el=$('cowclock'); if(!el)return; const d=DIFFS[difficulty]||{};
  if(d.group==='timed'){ el.style.display=''; el.textContent='🐄 '+fmtClock(cowClockMs); el.classList.toggle('low',cowClockMs<30000); }
  else { el.style.display='none'; } }
function recordMove(mv,who){ plies.push({san:mv.san,be:be(mv),from:mv.from,to:mv.to,fen:game.fen(),who}); viewPly=plies.length; renderMoves(); }

// ── eval bar (split board colors; 🐄/🧑 glyph shows who leads) ──
function setEvalFromInfo(){
  if(!lastInfo){ return; }
  // engine prints score from side-to-move POV AFTER cow's move it's your turn.
  // We normalize to "cow advantage in cp": cow just moved, score is now from your POV.
  // The `info ... score cp X` line is emitted DURING the cow's search, i.e. when it is
  // the cow's turn to move — so the score is already from the COW's point of view:
  // positive = the cow is better. (Earlier this negated it, which inverted the bar.)
  let cp = lastInfo.val;
  if(lastInfo.kind==='mate'){ cp = lastInfo.val>0 ? 100000 : -100000; }
  let cowAdv = cp;
  lastEval = cowAdv;
  drawEvalBar(cowAdv);
}
function cpToFrac(cp){ const x=Math.max(-1200,Math.min(1200,cp)); return 1/(1+Math.exp(-x/350)); } // 0..1, cow share
function drawEvalBar(cowAdv){
  // The bar mirrors the board: top segment = color of whoever is at the TOP of the board,
  // bottom segment = bottom side's color. "Bottom" is always you (human).
  // cowAdv>0 means the cow is better. Map to the cow's side of the bar.
  const cowFrac = cpToFrac(cowAdv);            // cow's share of the bar
  const cowAtBottom = (cowColor==='w' && flip) || (cowColor==='b' && !flip) ? false : true;
  // Simplify: you are always bottom; cow is always top. So top share = cowFrac.
  const topPct = Math.round(cowFrac*100);
  $('evalTop').style.height = topPct+'%';
  $('evalBot').style.height = (100-topPct)+'%';
  const lead = cowAdv>30 ? 'cow' : cowAdv<-30 ? 'you' : 'even';
  $('evalGlyph').textContent = lead==='cow' ? '🐄' : lead==='you' ? '🧑' : '·';
  $('evalGlyph').style.top = (lead==='cow' ? 4 : lead==='you' ? 'calc(100% - 26px)' : 'calc(50% - 11px)');
  const val=(cowAdv/100); const txt = Math.abs(cowAdv)>=100000 ? (cowAdv>0?'#':'-#') : (val>0?'+':'')+val.toFixed(1);
  $('evalNum').textContent = txt+' 🐄';
}

// ── move list (SAN + baby_elm) ──
function renderMoves(){
  const ml=$('movelist'); ml.innerHTML='';
  plies.forEach((p,i)=>{
    if(i%2===0){ const n=document.createElement('span'); n.className='num'; n.textContent=' '+(i/2+1)+'.'; ml.appendChild(n); }
    const s=document.createElement('span'); s.className='mv'; s.innerHTML=' '+p.san+' <span class="be">'+p.be+'</span>';
    ml.appendChild(s);
  });
  ml.scrollTop=ml.scrollHeight;
}

// ── sounds (Web Audio synth) ──
let actx=null, muted=false;
function ac(){ if(!actx){try{actx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}} if(actx&&actx.state==='suspended')actx.resume(); return actx; }
function blip(freq,dur,type,gain,when){ if(muted)return; const a=ac(); if(!a)return; const t=a.currentTime+(when||0);
  const o=a.createOscillator(),g=a.createGain(); o.type=type||'triangle'; o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain||.07,t+.005); g.gain.exponentialRampToValueAtTime(.0001,t+(dur||.08));
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+(dur||.08)+.02); }
function sound(mv){ if(muted||!mv)return; const san=mv.san||'';
  if(/#/.test(san)){ [523,659,784,1046].forEach((f,i)=>blip(f,.18,'triangle',.08,i*.09)); return; }
  if(san==='O-O'||san==='O-O-O'){ blip(300,.05,'square',.06); blip(360,.05,'square',.06,.07); return; }
  if(/=/.test(san)){ [392,523,659].forEach((f,i)=>blip(f,.12,'triangle',.07,i*.06)); return; }
  if(/\+/.test(san)){ blip(740,.06,'triangle',.06); blip(990,.06,'triangle',.05,.06); return; }
  if(/x/.test(san)){ blip(150,.10,'square',.09); blip(90,.08,'sine',.06,.01); return; }
  blip(220+Math.random()*30,.055,'triangle',.06); }

// ── after any move: eval, status, end detection ──
function updateAfterMove(){
  setEvalFromInfo();
  if(game.game_over()){
    let msg='game over';
    if(game.in_checkmate()){ const loser=game.turn(); const cowLost=loser===cowColor; msg= cowLost?'you win! 🎉':'the cow wins 🐄'; }
    else if(game.in_stalemate()) msg='stalemate';
    else if(game.in_draw()) msg='draw';
    setStatus(msg); if(game.in_checkmate()) blip(523,.2,'triangle',.08);
  }
}
function setStatus(s){ $('status').textContent=s; }

// ── controls ──
function newGame(){
  game.reset(); plies=[]; viewPly=0; be=BeTranslator(); selected=null; legalTargets=[]; lastInfo=null; lastEval=null;
  const d=DIFFS[difficulty]||DIFFS.t5;
  cowClockMs = (d.group==='timed') ? d.base : 0;
  send('ucinewgame'); send('isready');
  flip = (cowColor==='w');      // you at bottom: if cow is white, flip so you (black) are bottom
  drawBoard(); renderMoves(); drawEvalBar(0); updateClock(); setStatus('your move');
  if(game.turn()===cowColor) cowTurn();   // cow is white → she opens
}
function setColor(c){ cowColor=c; $('btnWhite').classList.toggle('on',c==='b'); $('btnBlack').classList.toggle('on',c==='w'); newGame(); }
function takeback(){
  if(thinking || plies.length===0) return;
  // Undo back to the human's turn: pop the most recent ply, and if that leaves it as
  // the cow's turn (i.e. we only removed the cow's reply), pop one more (the human move).
  game.undo(); plies.pop();
  if(plies.length && game.turn()===cowColor){ game.undo(); plies.pop(); }
  viewPly=plies.length; be=rebuildBE(); selected=null; legalTargets=[];
  drawBoard(); renderMoves(); updateAfterMove(); setStatus('your move');
}
function rebuildBE(){ const t=BeTranslator(); const g=new Chess(); for(const p of plies){ const mv=g.move(p.san); p.be=t(mv); } return t; }
function exportPGN(){
  const headers={Event:'cow_chess (browser)',White:cowColor==='b'?'You':'cow_chess',Black:cowColor==='b'?'cow_chess':'You',Date:new Date().toISOString().slice(0,10)};
  for(const [k,v] of Object.entries(headers)) game.header(k,v);
  const pgn=game.pgn({max_width:80,newline_char:'\n'});
  const blob=new Blob([pgn],{type:'text/plain'}); const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='cow_chess_game.pgn'; a.click();
}

// ── baby_elm reference modal ──
const BE_REF=[
  ['Pieces (white / black)', 'Each physical piece has its own glyph. The h-side rook, light-square bishop, and g-side knight use distinct “turned” glyphs so the two rooks/bishops/knights never blur together. Pawns are identified by their destination square.'],
  ['Squares', 'Every square is a single braille glyph — the dot pattern encodes file and rank. A move is read as “piece → square.”'],
  ['✶ capture', 'A six-pointed star sits between the piece and the square when the move is a capture.'],
  ['† check', 'A dagger after the square — a strike.'],
  ['☠ checkmate', 'A skull after the square — the kill.'],
];
function openRef(){ const host=$('refBody'); host.innerHTML='';
  BE_REF.forEach(([h,b])=>{ const d=document.createElement('div'); d.className='refrow'; d.innerHTML=`<b>${h}</b><span>${b}</span>`; host.appendChild(d); });
  // a quick live demo: the four opening glyphs
  const demo=document.createElement('div'); demo.className='refdemo';
  demo.innerHTML='example — <code>1. e4 ♙⣾  e5 ♟⣶  2. Nf3 🨢⡼  Nc6 ♞⢧</code>';
  host.appendChild(demo);
  $('refModal').classList.add('show'); }
function closeRef(){ $('refModal').classList.remove('show'); }

// ── wire it up ──
function init(){
  startWorker();
  $('btnNew').onclick=newGame;
  $('btnWhite').onclick=()=>setColor('b');   // you play white → cow black
  $('btnBlack').onclick=()=>setColor('w');
  $('btnTake').onclick=takeback;
  $('btnPGN').onclick=exportPGN;
  $('btnFlip').onclick=()=>{flip=!flip;drawBoard();};
  $('btnMute').onclick=()=>{muted=!muted;$('btnMute').textContent=muted?'🔇':'🔊';$('btnMute').classList.toggle('off',muted); if(!muted)blip(330,.05,'triangle',.05);};
  $('btnRef').onclick=openRef; $('refClose').onclick=closeRef; $('refModal').onclick=(e)=>{if(e.target===$('refModal'))closeRef();};
  if($('dbgClear'))$('dbgClear').onclick=()=>{_dbgLines=[];$('dbg').textContent='';};
  $('diff').onchange=(e)=>{difficulty=e.target.value; newGame();};
  $('btnTheme').onclick=()=>{const d=document.documentElement;const dark=d.getAttribute('data-theme')==='dark';d.setAttribute('data-theme',dark?'light':'dark');$('btnTheme').textContent=dark?'☾':'☀';try{localStorage.setItem('cow_theme',dark?'light':'dark');}catch(e){}};
  try{const t=localStorage.getItem('cow_theme')||(matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);$('btnTheme').textContent=t==='dark'?'☀':'☾';}catch(e){}
  // difficulty options — two groups: cow tournament clock, and fixed depth
  const sel=$('diff'); sel.innerHTML='';
  const gT=document.createElement('optgroup'); gT.label='cow tournament clock';
  const gD=document.createElement('optgroup'); gD.label='fixed depth';
  for(const [k,v] of Object.entries(DIFFS)){ const o=document.createElement('option'); o.value=k; o.textContent=v.label; if(k===difficulty)o.selected=true; (v.group==='timed'?gT:gD).appendChild(o); }
  sel.appendChild(gT); sel.appendChild(gD);
  flip=true; drawBoard(); renderMoves(); drawEvalBar(0); setStatus('press “new game” to play 🐄');
}
window.addEventListener('resize',()=>drawBoard());
init();
