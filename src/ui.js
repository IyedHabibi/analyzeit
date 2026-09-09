/* ============================================================
   UI — the same verified engines underneath, rebuilt so that
   every surface responds on press, every transition is a
   spring, and every gesture tracks 1:1.
   ============================================================ */
const main=document.getElementById('main'), deck=document.getElementById('deck'),
      tree=document.getElementById('tree'), rrail=document.getElementById('rrail'),
      side=document.getElementById('side'), scrim=document.getElementById('scrim');
const T=id=>TRACKS.find(t=>t.id===id);
const CHECK='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
const CHEV='<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5L8 6l-3.5 3.5"/></svg>';
wirePress(document.body);
const GY=id=>'<svg class="gy" viewBox="0 0 24 24" aria-hidden="true"><use href="#gy-'+id+'"/></svg>';
function paintTrack(id){ document.documentElement.dataset.track=id; }
/* One place that tears the intro down, used by every exit route:
   the nav, the sidebar, and the track pickers all go through this. */
function teardownWelcome(){
  document.body.classList.remove('locked');
  document.documentElement.classList.remove('label-mode');
  if(typeof teardownTicker==='function') teardownTicker();
  if(typeof wObs!=='undefined' && wObs){ wObs.disconnect(); wObs=null; }
  const sd=document.getElementById('sdeck');
  if(sd){
    if(typeof wScrollFn!=='undefined' && wScrollFn) sd.removeEventListener('scroll',wScrollFn);
    sd.remove();
  }
}

/* ---------- per-exercise progress ---------- */
state.ex = state.ex || {};                      /* current exercise index per lesson */
const exList = (t,l)=> (EX[key(t,l)]||[]);
const exKey  = (t,l,i)=> t+'-'+l+'-'+i;
const exDone = (t,l,i)=> !!state.done[exKey(t,l,i)];
const exCount= (t,l)=> exList(t,l).filter((_,i)=>exDone(t,l,i)).length;
const curEx  = ()=> state.ex[key(state.track,state.level)] || 0;
function setEx(i){ state.ex[key(state.track,state.level)] = i; }
/* A lesson counts as complete only when all of its exercises are. */
function syncLesson(t,l){
  const list=exList(t,l), k=key(t,l);
  const all = list.length>0 && list.every((_,i)=>exDone(t,l,i));
  if(all) state.done[k]=Date.now(); else delete state.done[k];
  save();
}
/* Lesson completion is derived, never authoritative on its own.
   Reconcile once at boot so a stale or hand-edited store cannot
   show a lesson complete with no exercises solved. */
function reconcile(){
  let changed=false;
  Object.keys(state.done).forEach(k=>{
    if(!/^[a-z]+-\d+$/.test(k)) return;
    const [t,l]=[k.split('-')[0], +k.split('-')[1]];
    const list=exList(t,l);
    const all = list.length>0 && list.every((_,i)=>exDone(t,l,i));
    if(!all){ delete state.done[k]; changed=true; }
  });
  TRACKS.forEach(t=>[0,1,2].forEach(l=>{
    const list=exList(t.id,l);
    if(list.length && list.every((_,i)=>exDone(t.id,l,i)) && !state.done[key(t.id,l)]){
      state.done[key(t.id,l)]=Date.now(); changed=true; }
  }));
  if(changed) save();
}

function solveEx(t,l,i){
  const first = !exDone(t,l,i);
  state.done[exKey(t,l,i)] = Date.now();
  syncLesson(t,l);
  return first;
}

/* flat ordering so swipe can move across track boundaries */
const ORDER=[]; TRACKS.forEach(t=>[0,1,2].forEach(l=>ORDER.push([t.id,l])));
const posOf=(t,l)=>ORDER.findIndex(o=>o[0]===t&&o[1]===l);

/* ---------- segmented control thumb ---------- */
const thumb=document.getElementById('thumb');
const thumbX=new Spring(0,{damping:1.0,response:0.34,onFrame:v=>{thumb.style.transform='translate3d('+v+'px,0,0)';}});
function moveThumb(instant){
  const cur=document.querySelector('#nav .seg[aria-current="page"]');
  if(!cur) return;
  const nav=cur.parentElement.getBoundingClientRect(), r=cur.getBoundingClientRect();
  thumb.style.width=r.width+'px';
  instant ? thumbX.set(r.left-nav.left) : thumbX.to(r.left-nav.left);
}
addEventListener('resize',()=>moveThumb(true));

/* ---------- sidebar tree ---------- */
function renderTree(){
  tree.innerHTML=TRACKS.map(t=>`
    <div class="trk ${state.open[t.id]?'open':''}" data-t="${t.id}" style="--tg:var(--${t.id})">
      <button class="trk-btn pressable soft" data-toggle="${t.id}">
        <span class="swatch"></span>
        <span class="trk-name">${t.name}</span>
        <span class="trk-frac">${trackDone(t.id)}/3</span>
        <span class="chev">${CHEV}</span>
      </button>
      <div class="lvls" data-lv="${t.id}">
        ${LEVELS.map((L,i)=>`<button class="lvl pressable soft" data-go="${t.id}:${i}"
          aria-current="${state.view==='learn'&&state.track===t.id&&state.level===i}">
          <span class="tick ${isDone(t.id,i)?'on':''}">${CHECK}</span>${L}</button>`).join('')}
      </div>
    </div>`).join('');
  tree.querySelectorAll('.lvls').forEach(el=>{
    el.style.height = state.open[el.dataset.lv] ? 'auto' : '0';
  });
}

/* ---------- right rail ---------- */
function renderRail(){
  if(state.view==='home'){
    let solved=0; TRACKS.forEach(t=>[0,1,2].forEach(l=>solved+=exCount(t.id,l)));
    const n=nextUp();
    rrail.innerHTML=`
      <div class="card"><h4>Your progress</h4>
        <div class="meter"><i data-w="${Math.round(solved/Math.max(1,EX_TOTAL())*100)}"></i></div>
        <div class="kv"><span>Exercises</span><b>${solved} / ${EX_TOTAL()}</b></div>
        <div class="kv"><span>Lessons</span><b>${doneCount()} / ${LESSON_TOTAL()}</b></div>
      </div>
      <div class="card"><h4>${solved?'Pick up here':'Suggested start'}</h4>
        ${n?`<p style="color:var(--label);font-weight:500">${LESSONS[key(n.t,n.l)].title}</p>
           <p>${T(n.t).name} · ${LEVELS[n.l]}</p>
           <button class="btn pri pressable" data-go="${n.t}:${n.l}" style="width:100%;justify-content:center;margin-top:5px">Open lesson</button>`
        :`<p>All ${EX_TOTAL()} solved. Take a Kaggle dataset and answer a question of your own end to end.</p>`}
      </div>
      <div class="card"><h4>Why these ${TRACKS.length}</h4>
        <p>Scan any junior data analyst posting and the same names come back. This path is those names, in the order they build on each other.</p>
      </div>`;
    const b=rrail.querySelector('.meter i');
    if(b){const w=+b.dataset.w; new Spring(0,{damping:1.0,response:0.55,onFrame:v=>b.style.width=v.toFixed(1)+'%'}).to(w);}
    return;
  }
  let solved=0; TRACKS.forEach(t=>[0,1,2].forEach(l=>solved+=exCount(t.id,l)));
  const pct=Math.round(solved/Math.max(1,EX_TOTAL())*100), nxt=nextUp();
  rrail.innerHTML=`
    <div class="card"><h4>Overall</h4>
      <div class="meter"><i data-w="${pct}"></i></div>
      <div class="kv"><span>Exercises</span><b>${solved} / ${EX_TOTAL()}</b></div>
      <div class="kv"><span>Lessons</span><b>${doneCount()} / ${LESSON_TOTAL()}</b></div>
      <div class="kv"><span>Tracks started</span><b>${TRACKS.filter(x=>trackDone(x.id)>0).length} / ${TRACKS.length}</b></div>
    </div>
    <div class="card"><h4>Up next</h4>
      ${nxt?`<p style="color:var(--label);font-weight:500">${LESSONS[key(nxt.t,nxt.l)].title}</p>
        <p>${T(nxt.t).name} · ${LEVELS[nxt.l]}</p>
        <button class="btn sec pressable" data-go="${nxt.t}:${nxt.l}" style="width:100%;justify-content:center;margin-top:5px">Open</button>`
      :`<p>All ${LESSON_TOTAL()} done. Rebuild one from memory without looking — that is the real test.</p>`}
    </div>
    <div class="card"><h4>Data behind this track</h4><p>${datasetNote(state.track)}</p>${kaggleLinks(state.track)}</div>
    <div class="card"><h4>Reference</h4>${refLinks(state.track)}</div>`;
  const bar=rrail.querySelector('.meter i');
  if(bar){ const w=+bar.dataset.w;
    new Spring(0,{damping:1.0,response:0.55,onFrame:v=>bar.style.width=v.toFixed(1)+'%'}).to(w); }
}
function nextUp(){ for(const t of TRACKS) for(let l=0;l<3;l++) if(!isDone(t.id,l)) return {t:t.id,l}; return null; }
function datasetNote(t){return{
  sql:'Three tables — employees, departments, orders — in a real SQLite database running in this page.',
  python:'Small frames defined inline so you can see every value. The shapes you meet in sales and HR exports.',
  excel:'A ten-row regional sales grid. Formulas below evaluate against it for real.',
  r:'A staff table mirroring the SQL employees table, so you can compare the two languages directly.',
  pbi:'The orders table, aggregated. The builder renders live from it.',
  git:'A repository with a single commit on main, rebuilt from scratch every time you press Run. Nothing here can be broken, so experiment.'
  /* Fallback: a track without a note renders nothing rather than the
     string "undefined", which is what shipped before git was added. */
  }[t] || '';}
function kaggleLinks(t){const L={
  sql:[['HR analytics','https://www.kaggle.com/datasets/pavansubhasht/ibm-hr-analytics-attrition-dataset'],['E-commerce sales','https://www.kaggle.com/datasets/carrie1/ecommerce-data']],
  python:[['Titanic','https://www.kaggle.com/competitions/titanic'],['Supermarket sales','https://www.kaggle.com/datasets/aungpyaeap/supermarket-sales']],
  excel:[['Superstore sales','https://www.kaggle.com/datasets/vivek468/superstore-dataset-final']],
  r:[['Salary and experience','https://www.kaggle.com/datasets/rsadiq/salary'],['Ames housing','https://www.kaggle.com/competitions/house-prices-advanced-regression-techniques']],
  pbi:[['Superstore sales','https://www.kaggle.com/datasets/vivek468/superstore-dataset-final'],['Wholesale orders','https://www.kaggle.com/datasets/gabrielsantello/wholesale-and-retail-orders-dataset']]}[t]||[];
  return L.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join('');}
function refLinks(t){const L={
  sql:[['SQLite language reference','https://www.sqlite.org/lang.html'],['Window functions','https://www.sqlite.org/windowfunctions.html']],
  python:[['pandas user guide','https://pandas.pydata.org/docs/user_guide/index.html'],['10 minutes to pandas','https://pandas.pydata.org/docs/user_guide/10min.html']],
  excel:[['Excel function list','https://support.microsoft.com/en-us/office/excel-functions-alphabetical-b3944572-255d-4efb-bb96-c6d90033e188']],
  r:[['dplyr reference','https://dplyr.tidyverse.org/reference/index.html'],['ggplot2 book','https://ggplot2-book.org/']],
  pbi:[['DAX reference','https://learn.microsoft.com/en-us/dax/dax-function-reference'],['Power Query docs','https://learn.microsoft.com/en-us/power-query/']],
  git:[['Pro Git (free book)','https://git-scm.com/book/en/v2'],['git rebase reference','https://git-scm.com/docs/git-rebase']]}[t]||[];
  return L.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join('');}

/* ---------- lesson ---------- */
function exTabs(){
  const list=exList(state.track,state.level), c=curEx();
  return `<div class="exbar">${list.map((_,i)=>
    `<button class="extab pressable ${exDone(state.track,state.level,i)?'solved':''}"
       data-ex="${i}" aria-current="${i===c}" aria-label="Exercise ${i+1}">${i+1}</button>`).join('')}
    <span class="exlabel">${exCount(state.track,state.level)} of ${list.length} solved</span></div>`;
}
function peekHTML(id){
  const P=PREVIEW[id]; if(!P) return '';
  let rows=P.rows.map(r=>'<tr>'+r.map(v=>'<td class="'+(typeof v==='number'?'n':'')+'">'+esc(String(v))+'</td>').join('')+'</tr>').join('');
  return `<div class="peek" data-peek>
    <button class="peek-h pressable soft" data-peektoggle>
      <span class="cv">${CHEV}</span><b>${esc(P.title)}</b><span class="sp"></span><span>the data</span></button>
    <div class="peek-b">
      <div style="overflow:auto"><table class="g"><thead><tr>${
        P.cols.map(c=>'<th>'+esc(c)+'</th>').join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="peek-n">${esc(P.note)}</div>
    </div></div>`;
}
function lessonHTML(){
  const t=T(state.track), L=LESSONS[key(state.track,state.level)], i=posOf(state.track,state.level);
  const E=exList(state.track,state.level)[curEx()] || {task:L.task,data:null};
  return `<div class="eyebrow">${GY(t.id)} ${t.name} · ${LEVELS[state.level]} · ${i+1} of ${LESSON_TOTAL()}</div>
    <h1 class="t-hero">${L.title}</h1>
    <div style="display:flex;gap:7px;margin-top:11px;flex-wrap:wrap">
      <span class="pill l${state.level+1}">${LEVELS[state.level]}</span>
      ${isDone(state.track,state.level)?`<span class="pill done">Completed</span>`
        :`<span class="pill" style="padding:0;background:none;color:var(--label-3);font-weight:500;letter-spacing:.14em">${exCount(state.track,state.level)}/${exList(state.track,state.level).length} solved</span>`}
    </div>
    <div class="scen t-sub">${L.scenario}</div>
    <div class="grp"><h3 class="t-head">How it works</h3><div class="prose t-body">${L.concept}</div></div>
    ${L.example?`<div class="grp"><h3 class="t-head">Worked example</h3>
      <div class="pane"><div class="pane-bar">${paneLabel(state.track)}<span class="sp"></span>
        ${(state.track==='sql'||state.track==='python')?'<button class="btn qui pressable" id="copyex" style="height:24px;padding:0 8px;font-size:12.5px">Copy to editor</button>':''}</div>
        <textarea class="code" readonly rows="${Math.min(15,L.example.split('\n').length+1)}">${esc(L.example)}</textarea>
        ${L.output?`<div class="out"><div class="outmsg">${esc(L.output)}</div></div>`:''}
      </div></div>`:''}
    <div class="grp"><h3 class="t-head">Your turn</h3>
      ${exTabs()}
      ${peekHTML(E.data)}
      <div class="prose t-body" style="margin-bottom:13px">${E.task}</div>
      <div id="workspace"></div>
      <div class="verdict" id="verdict"></div>
      <div style="margin-top:14px;display:flex;gap:9px;flex-wrap:wrap">
        <button class="btn sec pressable" id="hintbtn">Hint</button>
        <button class="btn sec pressable" id="solbtn">Solution</button>
        <button class="btn ${exDone(state.track,state.level,curEx())?'sec':'pri'} pressable" id="donebtn">
          ${exDone(state.track,state.level,curEx())?'Mark not done':'Mark solved'}</button>
      </div>
    </div>`;
}
function paneLabel(t){return{sql:'query.sql',python:'analysis.py',excel:'formula',r:'script.R',pbi:'notes'}[t];}

function renderLesson(){
  deck.innerHTML=lessonHTML();
  buildWorkspace();
  const c=document.getElementById('copyex');
  if(c) c.onclick=()=>{const ta=document.getElementById('userin');
    if(ta){ta.value=LESSONS[key(state.track,state.level)].example; ta.focus();}};
  const E=exList(state.track,state.level)[curEx()]||{};
  document.getElementById('hintbtn').onclick=()=>verdict('hint','<b>Hint.</b> '+E.hint);
  document.getElementById('solbtn').onclick=()=>verdict('hint','<b>One correct answer.</b><pre>'+esc(E.solution||'')+'</pre>');
  document.getElementById('donebtn').onclick=()=>{
    const i=curEx(), k=exKey(state.track,state.level,i);
    if(state.done[k]) delete state.done[k]; else state.done[k]=Date.now();
    syncLesson(state.track,state.level);
    renderTree(); renderRail(); hdr(); renderLesson();
  };
  deck.querySelectorAll('[data-ex]').forEach(b=>b.onclick=()=>{
    setEx(+b.dataset.ex); renderLesson();
  });
  const pk=deck.querySelector('[data-peektoggle]');
  if(pk) pk.onclick=()=>{
    const box=pk.closest('[data-peek]'), body=box.querySelector('.peek-b');
    const open=!box.classList.contains('open');
    box.classList.toggle('open',open);
    springHeight(body,open);
  };
}
/* Verdict springs its own height open — no layout jump, and it is
   interruptible if the user immediately checks again. */
function verdict(kind,html){
  const v=document.getElementById('verdict');
  if(!v) return;
  v.className='verdict '+kind; v.innerHTML=html;
  v.style.height='auto'; const h=v.scrollHeight; v.style.height='0px';
  if(!v._sp) v._sp=new Spring(0,{damping:1.0,response:0.36,
    onFrame:x=>{v.style.height=Math.max(0,x)+'px'; v.style.opacity=Math.min(1,x/Math.max(h*.5,1));}});
  v._sp.to(h);
}
const exSolvedTotal=()=>{let n=0;TRACKS.forEach(t=>[0,1,2].forEach(l=>n+=exCount(t.id,l)));return n;};
/* Totals are derived from ENABLED, so dropping a track cannot leave
   a stale "45" anywhere in the interface. */
/* Counted from the bank, not from the track list. These used to read
   TRACKS.length*3*3 and TRACKS.filter(t=>t.auto).length*9 -- which is a
   hardcoded three-per-lesson assumption wearing the costume of a derived
   value. The moment the bank grew past three per lesson the interface
   would have gone on claiming 36 exercises and 27 auto-checked while
   shipping 54 and 45. That is precisely the drift the ENABLED guardrail
   exists to prevent, hiding inside the guardrail itself. */
const LEVELS_N     = 3;
const exCountOf    = t => [...Array(LEVELS_N).keys()]
                            .reduce((n, l) => n + exList(t, l).length, 0);
const EX_TOTAL     = () => TRACKS.reduce((n, t) => n + exCountOf(t.id), 0);
const LESSON_TOTAL = () => TRACKS.reduce((n, t) =>
                       n + [...Array(LEVELS_N).keys()]
                             .filter(l => LESSONS[key(t.id, l)]).length, 0);
const AUTO_CHECKED = () => TRACKS.filter(t => t.auto)
                             .reduce((n, t) => n + exCountOf(t.id), 0);
/* Named lists for the honesty notes, so the copy cannot drift from the
   flag the grading actually uses. */
const AUTO_TRACKS   = () => TRACKS.filter(t=>t.auto);
const MANUAL_TRACKS = () => TRACKS.filter(t=>!t.auto);
function nameList(ts){
  const n = ts.map(t=>t.name);
  if(!n.length) return '';
  if(n.length===1) return n[0];
  return n.slice(0,-1).join(', ')+' and '+n.at(-1);
}
function hdr(){ const e=document.getElementById('hdone'); if(e) e.textContent=exSolvedTotal();
  const tt=document.getElementById('htot'); if(tt) tt.textContent=EX_TOTAL(); }

/* ---------- swipe deck: 1:1 tracking, rubber-band, momentum ---------- */
const deckX=new Spring(0,{damping:1.0,response:0.36,
  onFrame:v=>{deck.style.transform='translate3d('+v+'px,0,0)';
    deck.style.opacity=(1-Math.min(Math.abs(v)/900,0.32)).toFixed(3);}});
const hintL=document.getElementById('hintL'), hintR=document.getElementById('hintR');

function goto(t,l,dir){
  const from=posOf(state.track,state.level);
  const wasHome = state.view!=='learn';
  state.track=t; state.level=l; state.view='learn'; state.open[t]=true; paintTrack(t);
  /* goto() bypasses render(), so the welcome deck's scroll lock and
     observer must be released here too — otherwise the lesson loads
     inside a body that cannot scroll. */
  teardownWelcome();
  const to=posOf(t,l);
  const d = wasHome ? 0 : (dir!==undefined ? dir : (to>from?1:to<from?-1:0));
  renderTree(); renderRail(); hdr(); syncNav();
  renderLesson();
  if(d!==0){
    /* enter from the side it came from — symmetric paths */
    deckX.track(d*46, 0);
    deckX.to(0,{damping:1.0,response:0.4});
  } else deckX.to(0);
  main.scrollIntoView({block:'start',behavior:REDUCED.matches?'auto':'smooth'});
}

(function wireSwipe(){
  const tr=new Tracker();
  let active=false, startX=0, startY=0, base=0, axis=null, pid=null;
  const W=()=>Math.min(innerWidth,760);

  deck.addEventListener('pointerdown',e=>{
    if(state.view!=='learn') return;
    if(e.target.closest('textarea,input,button,a,.out,select')) return;
    if(e.pointerType==='mouse' && e.button!==0) return;
    active=true; axis=null; pid=e.pointerId;
    startX=e.clientX; startY=e.clientY; base=deckX.v;
    deckX.stop(); tr.reset(); tr.add(e.clientX,e.clientY);
  });
  deck.addEventListener('pointermove',e=>{
    if(!active||e.pointerId!==pid) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    /* detect direction once, ~10px hysteresis, then commit */
    if(axis===null){
      if(Math.abs(dx)<10 && Math.abs(dy)<10) return;
      axis = Math.abs(dx)>Math.abs(dy)*1.25 ? 'x' : 'y';
      if(axis==='x') deck.setPointerCapture(pid);
    }
    if(axis!=='x') return;
    e.preventDefault();
    tr.add(e.clientX,e.clientY);
    const i=posOf(state.track,state.level);
    let x=base+dx;
    /* resistance at the two ends of the whole path */
    if((i===0&&x>0)||(i===ORDER.length-1&&x<0)) x=rubberband(x,W());
    deckX.track(x, tr.velocity('x'));
    const p=Math.min(Math.abs(x)/110,1);
    hintL.style.opacity = x>0 && i>0 ? p : 0;
    hintR.style.opacity = x<0 && i<ORDER.length-1 ? p : 0;
  });
  const end=e=>{
    if(!active||(e&&e.pointerId!==pid)) return;
    const wasX=axis==='x'; active=false; axis=null;
    hintL.style.opacity=0; hintR.style.opacity=0;
    if(!wasX) return;
    const v=tr.velocity('x');
    /* project where the flick is GOING, don't snap from where it stopped */
    const projected=deckX.v+project(v);
    const i=posOf(state.track,state.level);
    let step=0;
    if(projected<-W()*0.30 && i<ORDER.length-1) step=1;
    else if(projected>W()*0.30 && i>0) step=-1;
    if(step!==0){
      const [t,l]=ORDER[i+step];
      /* fling out at the finger's velocity, then the new lesson
         enters from the matching side */
      deckX.to(-step*W()*0.55,{velocity:v,damping:1.0,response:0.28});
      setTimeout(()=>goto(t,l,-step), REDUCED.matches?0:150);
    } else {
      /* settle back — bounce only because a gesture carried momentum */
      deckX.to(0,{velocity:v,damping:0.82,response:0.34});
    }
  };
  deck.addEventListener('pointerup',end);
  deck.addEventListener('pointercancel',end);
  addEventListener('keydown',e=>{
    if(state.view!=='learn') return;
    const el=e.target;
    if(el && typeof el.closest==='function' && el.closest('textarea,input')) return;
    const i=posOf(state.track,state.level);
    if(e.key==='ArrowRight'&&i<ORDER.length-1){const[t,l]=ORDER[i+1];goto(t,l,1);}
    if(e.key==='ArrowLeft'&&i>0){const[t,l]=ORDER[i-1];goto(t,l,-1);}
  });
})();

/* ---------- sidebar sheet: drags 1:1, projects on release ---------- */
const sideX=new Spring(-290,{damping:1.0,response:0.34,
  onFrame:v=>{ side.style.transform='translate3d('+v+'px,0,0)';
    const p=1-Math.min(Math.abs(v)/290,1);
    scrim.style.opacity=p*0.42; scrim.classList.toggle('live',p>0.02); }});
let sheetOpen=false;
const isMobile=()=>innerWidth<=860;
function openSheet(o,vel){
  sheetOpen=o;
  sideX.to(o?0:-290,{velocity:vel,damping:1.0,response:0.34});
  document.getElementById('menu').setAttribute('aria-expanded',o);
}
document.getElementById('menu').onclick=()=>openSheet(!sheetOpen);
scrim.onclick=()=>openSheet(false);
(function wireSheet(){
  const tr=new Tracker(); let on=false,sx=0,sy=0,base=0,ax=null,pid=null;
  const grab=e=>{
    if(!isMobile()) return;
    const fromEdge = !sheetOpen && e.clientX<26;
    if(!sheetOpen && !fromEdge) return;
    if(sheetOpen && !side.contains(e.target) && e.target!==scrim) return;
    on=true; ax=null; pid=e.pointerId; sx=e.clientX; sy=e.clientY;
    base=sideX.v; sideX.stop(); tr.reset(); tr.add(e.clientX,e.clientY);
  };
  addEventListener('pointerdown',grab,{passive:true});
  addEventListener('pointermove',e=>{
    if(!on||e.pointerId!==pid) return;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    if(ax===null){ if(Math.abs(dx)<10&&Math.abs(dy)<10) return;
      ax=Math.abs(dx)>Math.abs(dy)?'x':'y'; if(ax!=='x'){on=false;return;} }
    tr.add(e.clientX,e.clientY);
    let x=base+dx;
    if(x>0) x=rubberband(x,290);          /* can't drag past open */
    if(x<-290) x=-290+rubberband(x+290,290);
    sideX.track(Math.min(0,x), tr.velocity('x'));
  },{passive:true});
  const done=e=>{
    if(!on||(e&&e.pointerId!==pid)) return;
    on=false; if(ax!=='x') return;
    const v=tr.velocity('x');
    const projected=sideX.v+project(v);
    /* velocity sign decides, not position — a fast flick commits
       even from a small displacement */
    openSheet(projected > -145, v);
  };
  addEventListener('pointerup',done); addEventListener('pointercancel',done);
})();
addEventListener('resize',()=>{ if(!isMobile()){ side.style.transform=''; scrim.style.opacity=0;
  scrim.classList.remove('live'); sheetOpen=false; } else sideX.set(sheetOpen?0:-290); });
