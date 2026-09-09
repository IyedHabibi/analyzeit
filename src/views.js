/* ============================================================
   WORKSPACES — same verified engines, restyled surfaces
   ============================================================ */
function buildWorkspace(){
  const w=document.getElementById('workspace');
  const L=exList(state.track,state.level)[curEx()] || LESSONS[key(state.track,state.level)];
  if(state.track==='sql')    return wsSQL(w,L);
  if(state.track==='python') return wsPy(w,L);
  if(state.track==='excel')  return wsExcel(w,L);
  if(state.track==='git')    return wsGit(w,L);
  if(state.track==='r')      return wsNotes(w,'script.R','R has no browser runtime available here, so write your answer and compare it with the solution.');
  return wsPBI(w,L);
}
function tableHTML(r){
  if(r.empty) return '<div class="outmsg">Query ran. No rows returned.</div>';
  let h='<table class="g"><thead><tr>';
  r.cols.forEach((c,i)=>{const n=r.rows.length&&typeof r.rows[0][i]==='number';
    h+='<th class="'+(n?'n':'')+'">'+esc(c)+'</th>';});
  h+='</tr></thead><tbody>';
  r.rows.slice(0,60).forEach(row=>{h+='<tr>'+row.map(v=>'<td class="'+(typeof v==='number'?'n':'')+'">'+
    (v===null?'<span style="color:var(--label-4)">NULL</span>':esc(String(v)))+'</td>').join('')+'</tr>';});
  h+='</tbody></table>';
  if(r.rows.length>60) h+='<div class="outmsg">'+(r.rows.length-60)+' more rows not shown.</div>';
  return h;
}
function wsSQL(w,L){
  w.innerHTML=`<div class="pane">
    <div class="pane-bar">query.sql<span class="sp"></span><span id="dbstate">starting database…</span></div>
    <textarea class="code" id="userin" rows="6" spellcheck="false" placeholder="SELECT …">SELECT * FROM employees LIMIT 5;</textarea>
    <div class="acts">
      <button class="btn pri pressable" id="runbtn" disabled>Run</button>
      <button class="btn sec pressable" id="checkbtn" disabled>Check answer</button>
      <span style="flex:1"></span>
      <button class="btn qui pressable" id="schemabtn">Schema</button>
    </div>
    <div class="out" id="out"><div class="outmsg">Run a query to see rows.</div></div></div>`;
  const st=document.getElementById('dbstate'), out=document.getElementById('out');
  initDB().then(()=>{st.textContent='sqlite ready';
    document.getElementById('runbtn').disabled=false; document.getElementById('checkbtn').disabled=false;})
   .catch(e=>{st.textContent='unavailable'; out.innerHTML='<div class="outmsg err">'+esc(e.message)+'</div>';});
  const go=check=>{
    const q=document.getElementById('userin').value.trim();
    if(!q){verdict('fail','Write a query first.');return;}
    let r; try{r=runSQL(q);}catch(e){
      out.innerHTML='<div class="outmsg err">'+esc(e.message)+'</div>';
      if(check) verdict('fail','<b>The query did not run.</b> Fix the error above and try again.'); return;}
    out.innerHTML=tableHTML(r);
    if(!check) return;
    let sol; try{sol=runSQL(L.solution);}catch(e){return;}
    if(sameResult(r,sol)){
      onSolved(r.rows.length+' row'+(r.rows.length===1?'':'s')+', matching values and order.');
    }else{
      const rc=r.rows.length, sc=sol.rows.length;
      verdict('fail','<b>Not matching yet.</b> '+(rc!==sc
        ? 'You returned '+rc+' row'+(rc===1?'':'s')+'; the answer has '+sc+'.'
        : r.cols.length!==sol.cols.length
          ? 'Right rows, but '+r.cols.length+' column'+(r.cols.length===1?'':'s')+' instead of '+sol.cols.length+'.'
          : 'Same shape, different values or ordering. Check your sort and your filter boundaries.'));
    }
  };
  document.getElementById('runbtn').onclick=()=>go(false);
  document.getElementById('checkbtn').onclick=()=>go(true);
  document.getElementById('schemabtn').onclick=()=>{out.innerHTML='<div class="outmsg">'+
    'employees(id, name, department, salary, years_exp, city)\ndepartments(id, name, head_count_budget, office)\norders(order_id, customer, country, category, quantity, unit_price, order_date)</div>';};
  document.getElementById('userin').addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();go(false);}});
}
function wsPy(w,L){
  w.innerHTML=`<div class="pane">
    <div class="pane-bar">analysis.py<span class="sp"></span><span id="pystate">runtime not loaded</span></div>
    <textarea class="code" id="userin" rows="9" spellcheck="false">${esc(PY_SETUP[L.data]||'')}</textarea>
    <div class="acts">
      <button class="btn pri pressable" id="loadbtn">Load Python · 15 MB</button>
      <button class="btn pri pressable" id="runbtn" style="display:none">Run</button>
      <button class="btn sec pressable" id="checkbtn" style="display:none">Check answer</button>
    </div>
    <div class="out" id="out"><div class="outmsg">Python runs in your browser through Pyodide. It is a one-time download, so it sits behind a button rather than loading on every page view.

Expected output for this exercise:
${esc(L.expect||'')}</div></div></div>`;
  const st=document.getElementById('pystate'), out=document.getElementById('out'),
        runb=document.getElementById('runbtn'), chkb=document.getElementById('checkbtn'), loadb=document.getElementById('loadbtn');
  const ready=()=>{st.textContent='python + pandas ready'; loadb.style.display='none';
    runb.style.display=''; chkb.style.display='';
    out.innerHTML='<div class="outmsg">Ready. Write your code and run it.</div>';};
  if(pyReady&&!pyLoading) ready();
  loadb.onclick=async()=>{loadb.disabled=true;
    try{await loadPy(m=>{st.textContent=m; out.innerHTML='<div class="outmsg">'+esc(m)+'</div>';}); ready();}
    catch(e){st.textContent='unavailable'; loadb.disabled=false;
      out.innerHTML='<div class="outmsg err">'+esc(e.message)+'\nYou can still write your answer and compare it with the solution.</div>';}};
  const go=async check=>{
    const code=document.getElementById('userin').value;
    if(!code.trim()){verdict('fail','Write some code first.');return;}
    out.innerHTML='<div class="outmsg">running…</div>';
    const {out:o,err}=await runPy(code);
    out.innerHTML='<div class="outmsg'+(err?' err':'')+'">'+esc((o||'')+(err?'\n'+err:''))+'</div>';
    if(!check) return;
    if(err){verdict('fail','<b>Your code raised an error.</b> Fix it and check again.');return;}
    const norm=s=>String(s).trim().split('\n').map(l=>l.trimEnd()).join('\n');
    if(norm(o)===norm(L.expect)){
      onSolved('Output matches exactly.');
    }else verdict('fail','<b>Output does not match.</b> Expected:<pre>'+esc(L.expect)+'</pre>');
  };
  runb.onclick=()=>go(false); chkb.onclick=()=>go(true);
}
function wsExcel(w,L){
  const cols=['A','B','C','D','E','F'];
  let g='<table class="g"><thead><tr><th style="width:36px"></th>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>';
  g+='<tr><td style="color:var(--label-4);text-align:center">1</td>'+SHEET.headers.map(h=>'<td><b>'+h+'</b></td>').join('')+'</tr>';
  SHEET.rows.forEach((r,i)=>{g+='<tr><td style="color:var(--label-4);text-align:center">'+(i+2)+'</td>'+
    r.map(v=>'<td class="'+(typeof v==='number'?'n':'')+'">'+v+'</td>').join('')+'</tr>';});
  g+='</tbody></table>';
  w.innerHTML=`<div class="pane">
    <div class="fbar"><label>fx</label><input type="text" id="userin" spellcheck="false" placeholder="=SUM(F2:F11)"></div>
    <div class="acts">
      <button class="btn pri pressable" id="runbtn">Evaluate</button>
      <button class="btn sec pressable" id="checkbtn">Check answer</button>
      <span style="flex:1"></span>
      <span id="result" class="mono" style="font-size:16px;font-weight:600;font-variant-numeric:tabular-nums"></span>
    </div>
    <div class="out">${g}</div></div>
  <div class="chips">${['SUM','AVERAGE','COUNT','COUNTA','MAX','MIN','MEDIAN','ROUND','IF','COUNTIF','SUMIF','AVERAGEIF','VLOOKUP','CONCAT','LEN'].map(f=>'<span class="chip">'+f+'</span>').join('')}</div>
  <p class="t-foot" style="color:var(--label-3);margin:9px 0 0">These all work here. Column F is Revenue, rows 2 to 11.</p>`;
  const res=document.getElementById('result');
  const go=check=>{
    let v; try{v=evalFormula(document.getElementById('userin').value);}
    catch(e){res.textContent=e.message; res.style.color='var(--bad)';
      if(check) verdict('fail','<b>The formula did not evaluate.</b> '+esc(e.message)); return;}
    const disp=typeof v==='number'?(Math.round(v*100)/100).toLocaleString():String(v);
    res.textContent=disp; res.style.color='var(--label)';
    if(!check) return;
    const ok=typeof L.expect==='number'&&typeof v==='number'
      ? Math.abs(v-L.expect)<0.01 : String(v).toLowerCase()===String(L.expect).toLowerCase();
    if(ok){
      onSolved('The formula returns '+disp+'.');
    }else verdict('fail','<b>That returns '+disp+'.</b> The answer is a different number — check which range and which function the task asked for.');
  };
  document.getElementById('runbtn').onclick=()=>go(false);
  document.getElementById('checkbtn').onclick=()=>go(true);
  document.getElementById('userin').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go(true);}});
}
function wsNotes(w,label,note){
  w.innerHTML=`<div class="pane"><div class="pane-bar">${label}<span class="sp"></span><span>compared by eye</span></div>
    <textarea class="code" id="userin" rows="7" spellcheck="false" placeholder="Write your answer here"></textarea></div>
  <p class="t-foot" style="color:var(--label-3);margin:9px 0 0">${note}</p>`;
}
function wsPBI(w,L){
  if(state.level!==1) return wsNotes(w,'notes.md','These two are conceptual — write your answer and compare it with the solution.');
  w.innerHTML=`<div class="pane">
    <div class="pane-bar">dashboard canvas<span class="sp"></span><span>teaching mockup, not Power BI</span></div>
    <div class="acts" id="vpick" style="box-shadow:inset 0 -.5px 0 var(--sep)">
      <button class="chip pressable soft" data-v="card" aria-pressed="true">Card · total</button>
      <button class="chip pressable soft" data-v="bar" aria-pressed="false">Bar · category</button>
      <button class="chip pressable soft" data-v="line" aria-pressed="false">Line · month</button>
      <button class="chip pressable soft" data-v="pie" aria-pressed="false">Pie · country</button>
    </div>
    <div class="pbi" id="canvas"></div></div>
  <p class="t-foot" style="color:var(--label-3);margin:9px 0 0">The pie is here so you can see why it fails past three slices.</p>`;
  const sel={card:true,bar:false,line:false,pie:false};
  const draw=()=>{
    const c=document.getElementById('canvas'); c.innerHTML=''; const D=pbiData();
    if(sel.card) c.insertAdjacentHTML('beforeend',
      `<div class="tile" style="grid-column:1/-1"><h4>Total revenue</h4><div class="big">€${D.total.toLocaleString()}</div>
       <div class="t-foot" style="color:var(--label-3);margin-top:3px">15 orders · Jan–Jul 2024</div></div>`);
    ['bar','line','pie'].forEach(k=>{if(sel[k]) c.insertAdjacentHTML('beforeend',
      `<div class="tile"><h4>${{bar:'Revenue by category',line:'Revenue by month',pie:'Revenue by country'}[k]}</h4>
       <div class="cbox"><canvas id="cv-${k}"></canvas></div></div>`);});
    ['bar','line','pie'].forEach(k=>{if(sel[k]) drawChart(k,D);});
  };
  document.getElementById('vpick').onclick=e=>{
    const b=e.target.closest('[data-v]'); if(!b) return;
    sel[b.dataset.v]=!sel[b.dataset.v]; b.setAttribute('aria-pressed',sel[b.dataset.v]); draw();};
  draw();
}
function pbiData(){
  const rows=[['Hardware',747,'Germany','01'],['Software',594,'France','01'],['Hardware',1899,'Netherlands','02'],
    ['Services',1600,'Italy','02'],['Software',1485,'Germany','02'],['Hardware',1498,'Sweden','03'],
    ['Services',2560,'France','03'],['Software',297,'Norway','03'],['Services',640,'Netherlands','04'],
    ['Hardware',1743,'Germany','04'],['Software',1237,'Italy','05'],['Services',960,'Sweden','05'],
    ['Hardware',2996,'Norway','06'],['Hardware',1899,'Italy','06'],['Services',3520,'Italy','07']];
  const by=i=>{const m={}; rows.forEach(r=>m[r[i]]=(m[r[i]]||0)+r[1]); return m;};
  return {total:rows.reduce((s,r)=>s+r[1],0),cat:by(0),country:by(2),month:by(3)};
}
let charts={};
function drawChart(kind,D){
  const el=document.getElementById('cv-'+kind); if(!el||!window.Chart) return;
  if(charts[kind]) charts[kind].destroy();
  const cs=getComputedStyle(document.documentElement);
  const ink=cs.getPropertyValue('--label-3').trim()||'#888', grid=cs.getPropertyValue('--sep').trim()||'#eee';
  const tint=cs.getPropertyValue('--tint').trim()||'#3B4CCA';
  const series=[tint,'#eb6834','#1baf7a','#eda100','#e87ba4'];
  const cfg={
    bar:{type:'bar',data:{labels:Object.keys(D.cat),datasets:[{data:Object.values(D.cat),backgroundColor:tint,borderRadius:6,maxBarThickness:36}]}},
    line:{type:'line',data:{labels:Object.keys(D.month).map(m=>({'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul'})[m]),
      datasets:[{data:Object.values(D.month),borderColor:tint,backgroundColor:tint,borderWidth:2.5,tension:.3,pointRadius:3}]}},
    pie:{type:'pie',data:{labels:Object.keys(D.country),datasets:[{data:Object.values(D.country),backgroundColor:series,borderWidth:0}]}}
  }[kind];
  cfg.options={responsive:true,maintainAspectRatio:false,animation:{duration:REDUCED.matches?0:420},
    plugins:{legend:{display:kind==='pie',position:'right',labels:{color:ink,font:{size:11},boxWidth:9,usePointStyle:true}}},
    scales:kind==='pie'?{}:{x:{ticks:{color:ink,font:{size:11}},grid:{display:false},border:{display:false}},
      y:{ticks:{color:ink,font:{size:11}},grid:{color:grid},border:{display:false},beginAtZero:true}}};
  el.setAttribute('role','img'); el.setAttribute('aria-label',kind+' chart of revenue');
  charts[kind]=new Chart(el,cfg);
}

/* Fires once per exercise, on the first correct answer only. */
function onSolved(detail){
  const t=state.track, l=state.level, i=curEx();
  const first=solveEx(t,l,i);
  const lessonJustDone=isDone(t,l);
  renderTree(); renderRail(); hdr();
  const list=exList(t,l), left=list.length-exCount(t,l);
  let sub = detail;
  if(lessonJustDone) sub = 'All '+list.length+' exercises in this lesson solved.';
  else if(left===1)  sub = detail+' One exercise left in this lesson.';
  else if(left>1)    sub = detail+' '+left+' left in this lesson.';
  if(first) celebrate(win(), sub); else verdict('pass','<b>'+win()+'</b> '+detail);
  /* update the tab strip and the button without losing the verdict */
  const strip=deck.querySelector('.exbar');
  if(strip){
    const nb=document.createElement('div'); nb.innerHTML=exTabs();
    strip.replaceWith(nb.firstElementChild);
    deck.querySelectorAll('[data-ex]').forEach(b=>b.onclick=()=>{setEx(+b.dataset.ex); renderLesson();});
    const just=deck.querySelector('[data-ex="'+i+'"]'); popTick(just);
  }
  const db=document.getElementById('donebtn');
  if(db){ db.textContent='Mark not done'; db.className='btn sec pressable'; }
}

/* ---------- practice ---------- */
function renderPractice(){
  const rows=[];
  TRACKS.forEach(t=>LEVELS.forEach((L,i)=>{
    const les=LESSONS[key(t.id,i)];
    rows.push(`<button class="prow pressable soft" data-go="${t.id}:${i}">
      <span style="--tg:var(--${t.id});display:flex">${GY(t.id)}</span>
      <span class="pt"><b>${les.title}</b><span>${t.name} · ${L}</span></span>
      <span class="t-foot" style="color:var(--label-3);font-variant-numeric:tabular-nums">${exCount(t.id,i)}/${exList(t.id,i).length}</span>
      <span class="pill l${i+1}">${L}</span>
      <span class="tick ${isDone(t.id,i)?'on':''}">${CHECK}</span></button>`);
  }));
  deck.innerHTML=`<h1 class="t-title">Practice</h1>
    <p class="t-body" style="color:var(--label-2);max-width:60ch;margin-top:9px">Every exercise, in path order. ${nameList(AUTO_TRACKS())} ${AUTO_TRACKS().length===1?'is':'are'} checked automatically against a correct answer${TRACKS.some(t=>t.id==='python')?' (Python once you load the runtime)':''}.${MANUAL_TRACKS().length?` ${nameList(MANUAL_TRACKS())} ${MANUAL_TRACKS().length===1?'is':'are'} compared by eye.`:''}</p>
    <div class="plist">${rows.join('')}</div>`;
}


/* ---------- progress ---------- */
function renderProgress(){
  let g='<div class="pgrid"><div></div>'+LEVELS.map(l=>'<div class="pgh">'+l.slice(0,3)+'</div>').join('');
  TRACKS.forEach(t=>{
    g+='<div class="plbl" style="--tg:var(--'+t.id+')">'+GY(t.id)+t.name+'</div>';
    LEVELS.forEach((_,i)=>{
      const d=isDone(t.id,i), part=exCount(t.id,i), tot=exList(t.id,i).length;
      const label=t.name+' '+LEVELS[i]+', '+part+' of '+tot+' solved';
      g+='<button class="pc '+(d?'on':'')+' pressable" data-go="'+t.id+':'+i+'" aria-label="'+label+'" '+
        (d?'style="background:var(--'+t.id+')"':'')+'>'+
        (d?CHECK:(part?'<span style="font-size:12.5px;font-weight:600;color:var(--'+t.id+')">'+part+'/'+tot+'</span>':''))+
        '</button>';});
  });
  g+='</div>';
  const started=TRACKS.filter(t=>trackDone(t.id)>0).length, finished=TRACKS.filter(t=>trackDone(t.id)===3).length, nxt=nextUp();
  deck.innerHTML=`<h1 class="t-title">Progress</h1>
    <p class="t-body" style="color:var(--label-2);max-width:60ch;margin-top:9px">${TRACKS.length} tools, three levels, three exercises each — ${EX_TOTAL()} in total. A cell fills once every exercise in that lesson is solved. Tap any cell to jump there.</p>
    ${g}
    <div class="stats">
      <div class="stat"><b data-n="${exSolvedTotal()}">0</b><span>of ${EX_TOTAL()} exercises solved</span></div>
      <div class="stat"><b data-n="${Math.round(exSolvedTotal()/Math.max(1,EX_TOTAL())*100)}" data-suf="%">0</b><span>of the path</span></div>
      <div class="stat"><b data-n="${doneCount()}">0</b><span>of ${LESSON_TOTAL()} lessons complete</span></div>
      <div class="stat"><b data-n="${finished}">0</b><span>tracks finished</span></div>
    </div>
    <div class="grp"><h3 class="t-head">What to do next</h3><div class="prose t-body" style="max-width:62ch">
      ${nxt?`<p>Your next unfinished lesson is <b>${LESSONS[key(nxt.t,nxt.l)].title}</b> in ${T(nxt.t).name}.</p>
        <button class="btn pri pressable" data-go="${nxt.t}:${nxt.l}">Open it</button>`
      :`<p>All ${LESSON_TOTAL()} are done. The path ends here; the skill does not. Take a Kaggle dataset, decide what question is worth asking, and answer it end to end. That is what a portfolio is.</p>`}
    </div></div>
    <div class="grp"><h3 class="t-head">How checking works</h3><div class="prose t-body" style="max-width:62ch"><ul>
      ${TRACKS.filter(t=>t.auto).map(t=>`<li><b>${t.name}</b> — ${t.checked}</li>`).join('')}
      ${(()=>{const m=TRACKS.filter(t=>!t.auto); if(!m.length) return '';
        const names=m.length===1?m[0].name:m.slice(0,-1).map(t=>t.name).join(', ')+' and '+m[m.length-1].name;
        return `<li><b>${names}</b> — no browser runtime exists for ${m.length===1?'it':'these'} here, so you compare against a worked solution yourself.</li>`;})()}</ul>
      <p class="t-foot" style="color:var(--label-3)">Progress is stored in this browser. Sign in and it also syncs to your account — nothing else is collected, and there is no tracking or analytics.</p>
    </div></div>`;
  /* count up — springs the number, not just the bar */
  deck.querySelectorAll('.stat b').forEach(el=>{
    const n=+el.dataset.n, suf=el.dataset.suf||'';
    if(REDUCED.matches){el.textContent=n+suf;return;}
    new Spring(0,{damping:1.0,response:0.7,onFrame:v=>el.textContent=Math.round(v)+suf}).to(n);
  });
}

/* ---------- routing ---------- */
function syncNav(){
  document.querySelectorAll('#nav .seg').forEach(b=>{
    b.dataset.view===state.view ? b.setAttribute('aria-current','page') : b.removeAttribute('aria-current');});
  moveThumb();
}
function render(){
  /* the welcome deck owns its own scroll container, so the page
     behind it must not scroll too */
  document.body.classList.toggle('locked', state.view==='home');
  if(state.view!=='home') teardownWelcome();
  renderTree(); renderRail(); hdr(); syncNav();
  try{
    if(state.view==='home') renderWelcome();
    else if(state.view==='learn') renderLesson();
    else if(state.view==='practice') renderPractice();
    else renderProgress();
  }catch(e){
    deck.innerHTML='<h1 class="t-title">This lesson failed to load</h1><p class="t-body" style="color:var(--ink-2);max-width:58ch">'+
      esc(e.message)+'</p><p class="t-foot" style="color:var(--ink-3)">Pick another from the sidebar, or reload.</p>';
  }
  deckX.set(0);
}
document.getElementById('nav').addEventListener('click',e=>{
  const b=e.target.closest('[data-view]'); if(!b) return;
  state.view=b.dataset.view; render();
});
document.body.addEventListener('click',e=>{
  const g=e.target.closest('[data-go]');
  if(g){ const [t,l]=g.dataset.go.split(':');
    if(isMobile()&&sheetOpen) openSheet(false);
    goto(t,+l); return; }
  const tg=e.target.closest('[data-toggle]');
  if(tg){ const id=tg.dataset.toggle;
    state.open[id]=!state.open[id];
    tg.closest('.trk').classList.toggle('open',state.open[id]);
    springHeight(tree.querySelector('[data-lv="'+id+'"]'), state.open[id]); }
});
/* Ease the theme change — an abrupt brightness jump is a
   vestibular problem, not just a taste one. */
/* Accounts. paintAccount() runs first so the header reflects a restored
   session before syncBoot() has finished talking to the network, and
   syncBoot() itself makes no request at all for an anonymous visitor. */
document.getElementById('acct').onclick = () => openAuth();
paintAccount();
syncBoot();

document.getElementById('theme').onclick=()=>{
  const dark=document.documentElement.dataset.theme==='dark';
  document.body.style.transition='background-color 260ms ease, color 260ms ease';
  document.documentElement.dataset.theme=dark?'light':'dark';
  try{localStorage.setItem('bench.theme',dark?'light':'dark');}catch(e){}
  setTimeout(()=>document.body.style.transition='',300);
  if(state.view==='learn'&&state.track==='pbi'&&state.level===1) renderLesson();
};
document.getElementById('reset').onclick=()=>{state.done={}; save(); render();};
/* theme already applied pre-paint in head; just sync the control */
reconcile();
render(); moveThumb(true);
if(isMobile()) sideX.set(-290);

/* ============================================================
   HOME — the page that was missing. Answers, in order: what is
   this, what will I be able to do, where do I start.
   ============================================================ */
function renderHome(){
  paintTrack('sql');
  const solved=exSolvedTotal(), nxt=nextUp();
  const resuming = solved>0;
  const blurb={
    sql:'Pull the numbers out of a database. The skill named in almost every data job ad.',
    python:'Clean and reshape messy exports with pandas — where most of the job actually goes.',
    excel:'The tool every data team still runs on, whatever else is in the stack.',
    r:'Statistics and model output, and how to report them without overclaiming.',
    pbi:'Turn a finished table into something a director can make a decision from.'};
  const cards=TRACKS.map((t,i)=>{
    const s=[0,1,2].reduce((a,l)=>a+exCount(t.id,l),0);
    return `<button class="tcard pressable stag" style="--tg:var(--${t.id})" data-go="${t.id}:${firstUnsolved(t.id)}">
      <span class="tnum">${String(i+1).padStart(2,'0')}</span>
      ${GY(t.id)}
      <h3>${t.name}</h3>
      <p>${blurb[t.id]}</p>
      <div class="tbar"><i data-w="${Math.round(s/9*100)}"></i></div>
      <div class="tmeta"><span>${s} of 9 solved</span><span>3 levels</span></div>
    </button>`;}).join('');

  deck.innerHTML=`
  <div class="hero">
    <span class="hero-k"><i></i>Five tools · 15 lessons · 45 exercises</span>
    <h1 class="t-hero">You don't learn SQL by <em>watching</em> someone write SQL.</h1>
    <p class="lede">So here you write it — against a real database running in this tab, which tells you the moment you are right.</p>
    <div class="cta">
      ${resuming
        ? `<button class="btn pri lg pressable" data-go="${nxt?nxt.t+':'+nxt.l:'sql:0'}">Continue where you left off</button>
           <span class="cta-note">${solved}/${EX_TOTAL()} solved${nxt?' · next: '+T(nxt.t).name.toLowerCase():''}</span>`
        : `<button class="btn pri lg pressable" data-go="sql:0">Write your first query</button>
           <span class="cta-note">~3 min · nothing to install</span>`}
    </div>

    <div class="demo" id="demo">
      <div class="demo-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
        <span class="sp"></span><span>employees · sqlite/wasm</span></div>
      <div class="demo-q" id="demoQ"></div>
      <div class="demo-res" id="demoR"></div>
      <div class="demo-foot" id="demoF"></div>
    </div>

    <div class="facts">
      <div class="fact stag"><b class="roll" data-n="${EX_TOTAL()}">0</b><span>exercises across ${TRACKS.length} tools</span></div>
      <div class="fact stag"><b class="roll" data-n="${AUTO_CHECKED()}">0</b><span>checked automatically</span></div>
      <div class="fact stag"><b class="roll" data-n="${LESSON_TOTAL()}">0</b><span>lessons, beginner to advanced</span></div>
      <div class="fact stag"><b class="roll" data-n="0">0</b><span>things to install</span></div>
    </div>
  </div>

  <div class="secttl"><h2>The path</h2><span>work through it in order, or jump in anywhere</span></div>
  <div class="tcards">${cards}</div>

  <div class="secttl"><h2>How it works</h2><span>no video, no quizzes about syntax</span></div>
  <div class="steps">
    <div class="step"><span class="sn">1</span><div><b>Read the job scenario</b>
      <span>Every lesson opens with the request as a manager would actually send it — vague deadline included.</span></div></div>
    <div class="step"><span class="sn">2</span><div><b>Look at the data first</b>
      <span>The rows you are querying sit right above the editor, with a note pointing at whatever is going to trip you up.</span></div></div>
    <div class="step"><span class="sn">3</span><div><b>Write it, run it, get told</b>
      <span>${TRACKS.filter(t=>t.auto).map(t=>t.name).join(', ')} all run for real in your browser. Your answer is compared with a correct one, not marked by you.</span></div></div>
    <div class="step"><span class="sn">4</span><div><b>Three exercises per lesson</b>
      <span>One worked example is not practice. The lesson only completes when all three are solved.</span></div></div>
  </div>

  <div class="secttl"><h2>What is real, and what is not</h2><span>worth knowing before you start</span></div>
  <div class="steps">
    <div class="step"><span class="sn">✓</span><div><b>${nameList(AUTO_TRACKS())} ${AUTO_TRACKS().length===1?'is':'are'} genuinely executed</b>
      <span>${nameList(AUTO_TRACKS().map(t=>({name:t.runtime})))}. Your answers are machine-checked against a correct result.</span></div></div>
    ${MANUAL_TRACKS().length ? `<div class="step"><span class="sn">~</span><div><b>${nameList(MANUAL_TRACKS())} ${MANUAL_TRACKS().length===1?'is a written answer':'are written answers'}</b>
      <span>No runtime for ${MANUAL_TRACKS().length===1?'it':'them'} can run in a browser here, so those exercises are compared against a worked solution by eye. That is the weakest part of this and worth saying plainly.</span></div></div>` : ''}
    <div class="step"><span class="sn">↓</span><div><b>Sample data modelled on Kaggle sets</b>
      <span>Kaggle needs a login and blocks browser requests, so the tables are embedded. Links to the real datasets sit in the sidebar of every lesson.</span></div></div>
  </div>

  <p class="t-foot" style="color:var(--label-3);margin:30px 0 0;max-width:62ch">Progress is saved in this browser. An account is optional — sign in and it also syncs across your devices; stay signed out and nothing leaves this browser. Either way there is no tracking and no analytics.</p>`;

  runHeroDemo();
  deck.querySelectorAll('.roll').forEach(el=>{
    const n=+el.dataset.n;
    if(REDUCED.matches||n===0){el.textContent=n;return;}
    new Spring(0,{damping:1.0,response:0.75,onFrame:x=>el.textContent=Math.round(x)}).to(n);
  });
  deck.querySelectorAll('.tbar i').forEach(bar=>{
    const w=+bar.dataset.w;
    if(REDUCED.matches){bar.style.width=w+'%';return;}
    new Spring(0,{damping:1.0,response:0.6,onFrame:v=>bar.style.width=v.toFixed(1)+'%'}).to(w);
  });
}
function firstUnsolved(tid){
  for(let l=0;l<3;l++) if(exCount(tid,l)<exList(tid,l).length) return l;
  return 0;
}


/* ============================================================
   HERO DEMO — types a query, then returns rows. The most
   characteristic thing in this product's world is a result set,
   so the hero shows one rather than describing one.
   Runs once per home visit; skipped entirely under reduced motion.
   ============================================================ */
var DEMO_SQL=[['SELECT','kw'],[' name, salary\n','tx'],['FROM','kw'],[' employees\n','tx'],
  ['WHERE','kw'],[' department = ','tx'],["'Data'",'st'],['\n','tx'],
  ['ORDER BY','kw'],[' salary ','tx'],['DESC','kw'],[';','tx']];
var DEMO_ROWS=[['Mei Chen','118,000'],['Luca Ferrari','96,000'],['Amira Haddad','82,000'],['Sara Novak','61,000']];
var demoTimer=null;
function runHeroDemo(){
  const q=document.getElementById('demoQ'), r=document.getElementById('demoR'), f=document.getElementById('demoF');
  if(!q) return;
  if(demoTimer){clearTimeout(demoTimer);demoTimer=null;}
  const paintRows=()=>{
    r.innerHTML='<table><thead><tr><th>name</th><th class="n">salary</th></tr></thead><tbody>'+
      DEMO_ROWS.map(([a,b])=>'<tr><td>'+a+'</td><td class="n">'+b+'</td></tr>').join('')+'</tbody></table>';
    f.textContent='4 rows · 0.6 ms';
  };
  if(REDUCED.matches){
    q.innerHTML=DEMO_SQL.map(([t,c])=>'<span class="'+c+'">'+t.replace(/\n/g,'<br>')+'</span>').join('');
    paintRows(); r.querySelectorAll('tr').forEach(tr=>tr.classList.add('in')); return;
  }
  q.innerHTML='<span class="caret"></span>'; r.innerHTML=''; f.textContent='';
  let seg=0, ch=0, html='';
  const tick=()=>{
    if(seg>=DEMO_SQL.length){
      q.innerHTML=html;
      f.textContent='running…';
      demoTimer=setTimeout(()=>{
        paintRows(); f.textContent='4 rows · 0.6 ms';
        [...r.querySelectorAll('tbody tr')].forEach((tr,i)=>
          setTimeout(()=>tr.classList.add('in'), i*70));   /* stagger, 70ms */
      },340);
      return;
    }
    const [txt,cls]=DEMO_SQL[seg];
    ch++;
    if(ch>txt.length){seg++;ch=0;demoTimer=setTimeout(tick,0);return;}
    const done=DEMO_SQL.slice(0,seg).map(([t,c])=>'<span class="'+c+'">'+t.replace(/\n/g,'<br>')+'</span>').join('');
    html=done+'<span class="'+cls+'">'+txt.slice(0,ch).replace(/\n/g,'<br>')+'</span>';
    q.innerHTML=html+'<span class="caret"></span>';
    demoTimer=setTimeout(tick, txt[ch-1]==='\n'?90:18);
  };
  demoTimer=setTimeout(tick,340);
}
