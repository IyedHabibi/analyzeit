
/* ============================================================
   STATE — localStorage where available, memory otherwise.
   ============================================================ */
const KEY='bench.progress.v2';   /* v1 stored lesson-level keys only; not migratable */
let state = {done:{}, view:'home', track:'sql', level:0, open:{sql:true}};
try{ const s=localStorage.getItem(KEY); if(s) state.done=JSON.parse(s).done||{}; }catch(e){}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify({done:state.done})); }catch(e){} }
const key=(t,l)=>t+'-'+l;
const isDone=(t,l)=>!!state.done[key(t,l)];
function markDone(t,l){ state.done[key(t,l)]=Date.now(); save(); renderTree(); renderRail(); hdr(); }
/* Lesson keys look like "sql-0"; exercise keys like "sql-0-2".
   Counting every key conflated the two and inflated the lesson total. */
const isLessonKey = k => /^[a-z]+-\d+$/.test(k);
function doneCount(){ return Object.keys(state.done).filter(isLessonKey).length; }
function trackDone(t){ return [0,1,2].filter(l=>isDone(t,l)).length; }
function hdr(){ document.getElementById('hdone').textContent = doneCount(); }

/* ============================================================
   SQL ENGINE — real SQLite via WebAssembly
   ============================================================ */
let DB=null, dbReady=null;
function initDB(){
  if(dbReady) return dbReady;
  if(typeof initSqlJs!=='function'){
    dbReady=Promise.reject(new Error('The SQLite engine did not load. Check your connection, then reload — the rest of the lesson still works.'));
    dbReady.catch(()=>{});
    return dbReady;
  }
  try{
    dbReady = initSqlJs({locateFile:f=>'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/'+f})
      .then(SQL=>{ DB=new SQL.Database(); DB.run(DB_SQL); return DB; });
  }catch(e){ dbReady=Promise.reject(e); dbReady.catch(()=>{}); }
  return dbReady;
}
function runSQL(q){
  const res = DB.exec(q);
  if(!res.length) return {cols:[],rows:[],empty:true};
  return {cols:res[0].columns, rows:res[0].values};
}
function sameResult(a,b){
  if(a.rows.length!==b.rows.length) return false;
  if(a.cols.length!==b.cols.length) return false;
  const norm=r=>r.map(v=>{
    if(v===null) return 'NULL';
    if(typeof v==='number') return String(Math.round(v*1e6)/1e6);
    return String(v).trim();
  }).join('\u0001');
  const A=a.rows.map(norm), B=b.rows.map(norm);
  return A.every((v,i)=>v===B[i]);
}
function tableHTML(r){
  if(r.empty) return '<div class="out-msg">Query ran. No rows returned.</div>';
  let h='<table class="grid"><thead><tr>';
  r.cols.forEach((c,i)=>{
    const n = r.rows.length && typeof r.rows[0][i]==='number';
    h+='<th class="'+(n?'num':'')+'">'+esc(c)+'</th>';
  });
  h+='</tr></thead><tbody>';
  r.rows.slice(0,60).forEach(row=>{
    h+='<tr>'+row.map(v=>'<td class="'+(typeof v==='number'?'num':'')+'">'+(v===null?'<span style="color:var(--ink-3)">NULL</span>':esc(String(v)))+'</td>').join('')+'</tr>';
  });
  h+='</tbody></table>';
  if(r.rows.length>60) h+='<div class="out-msg">'+(r.rows.length-60)+' more rows not shown.</div>';
  return h;
}
function esc(s){return s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

/* ============================================================
   EXCEL FORMULA EVALUATOR
   Supports: + - * / ^ %, parentheses, ranges, and the functions
   below. Written for teaching, not for spec completeness.
   ============================================================ */
function colIdx(letter){ let n=0; for(const c of letter.toUpperCase()) n=n*26+(c.charCodeAt(0)-64); return n-1; }
function cellVal(ref){
  const m=/^\$?([A-Za-z]+)\$?(\d+)$/.exec(ref);
  if(!m) throw new Error('Bad reference: '+ref);
  const c=colIdx(m[1]), r=parseInt(m[2],10);
  if(r===1) return SHEET.headers[c] ?? '';
  const row=SHEET.rows[r-2];
  if(!row) return '';
  return row[c] ?? '';
}
function rangeVals(a,b){
  const ma=/^\$?([A-Za-z]+)\$?(\d+)$/.exec(a), mb=/^\$?([A-Za-z]+)\$?(\d+)$/.exec(b);
  if(!ma||!mb) throw new Error('Bad range');
  const c1=colIdx(ma[1]),r1=+ma[2],c2=colIdx(mb[1]),r2=+mb[2];
  const out=[];
  for(let r=Math.min(r1,r2); r<=Math.max(r1,r2); r++)
    for(let c=Math.min(c1,c2); c<=Math.max(c1,c2); c++){
      if(r===1) out.push(SHEET.headers[c] ?? '');
      else { const row=SHEET.rows[r-2]; out.push(row ? (row[c] ?? '') : ''); }
    }
  return out;
}
const nums = a => a.filter(v=>typeof v==='number'&&!isNaN(v));
function matches(v, crit){
  crit=String(crit).trim();
  const m=/^(>=|<=|<>|>|<|=)(.+)$/.exec(crit);
  if(m){
    const op=m[1]; let t=m[2].trim().replace(/^"|"$/g,'');
    const tn=parseFloat(t), vn=typeof v==='number'?v:parseFloat(v);
    if(!isNaN(tn)&&!isNaN(vn)){
      if(op==='>')return vn>tn; if(op==='<')return vn<tn;
      if(op==='>=')return vn>=tn; if(op==='<=')return vn<=tn;
      if(op==='=')return vn===tn; if(op==='<>')return vn!==tn;
    }
    const vs=String(v).toLowerCase(), ts=t.toLowerCase();
    return op==='<>' ? vs!==ts : vs===ts;
  }
  crit=crit.replace(/^"|"$/g,'');
  if(typeof v==='number'&&!isNaN(parseFloat(crit))) return v===parseFloat(crit);
  return String(v).toLowerCase()===crit.toLowerCase();
}
const XLFN={
  SUM:a=>nums(flat(a)).reduce((s,v)=>s+v,0),
  AVERAGE:a=>{const n=nums(flat(a)); if(!n.length) throw new Error('#DIV/0!'); return n.reduce((s,v)=>s+v,0)/n.length;},
  COUNT:a=>nums(flat(a)).length,
  COUNTA:a=>flat(a).filter(v=>v!=='' && v!==null && v!==undefined).length,
  MAX:a=>{const n=nums(flat(a)); if(!n.length) throw new Error('#VALUE!'); return Math.max(...n);},
  MIN:a=>{const n=nums(flat(a)); if(!n.length) throw new Error('#VALUE!'); return Math.min(...n);},
  MEDIAN:a=>{const n=nums(flat(a)).sort((x,y)=>x-y); if(!n.length) throw new Error('#VALUE!');
    const m=Math.floor(n.length/2); return n.length%2?n[m]:(n[m-1]+n[m])/2;},
  ROUND:(a)=>{const v=one(a[0]), d=one(a[1])??0; const f=Math.pow(10,d); return Math.round(v*f)/f;},
  ABS:a=>Math.abs(one(a[0])),
  IF:a=>{const t=one(a[0]); return t?(a[1]!==undefined?one(a[1]):true):(a[2]!==undefined?one(a[2]):false);},
  COUNTIF:a=>{const r=arr(a[0]); const c=one(a[1]); return r.filter(v=>matches(v,c)).length;},
  SUMIF:a=>{const r=arr(a[0]), c=one(a[1]), s=a[2]!==undefined?arr(a[2]):r;
    let t=0; r.forEach((v,i)=>{ if(matches(v,c)&&typeof s[i]==='number') t+=s[i]; }); return t;},
  AVERAGEIF:a=>{const r=arr(a[0]), c=one(a[1]), s=a[2]!==undefined?arr(a[2]):r;
    let t=0,n=0; r.forEach((v,i)=>{ if(matches(v,c)&&typeof s[i]==='number'){t+=s[i];n++;} });
    if(!n) throw new Error('#DIV/0!'); return t/n;},
  VLOOKUP:a=>{const key=one(a[0]), tbl=a[1], col=one(a[2]);
    if(!tbl||!tbl.__range) throw new Error('VLOOKUP needs a range');
    const {c1,c2,r1,r2}=tbl.__range; const width=c2-c1+1;
    for(let r=r1;r<=r2;r++){
      const first = r===1 ? SHEET.headers[c1] : (SHEET.rows[r-2]||[])[c1];
      if(String(first).toLowerCase()===String(key).toLowerCase()){
        if(col<1||col>width) throw new Error('#REF!');
        return r===1 ? SHEET.headers[c1+col-1] : (SHEET.rows[r-2]||[])[c1+col-1];
      }
    }
    throw new Error('#N/A');},
  CONCAT:a=>flat(a).map(v=>String(v)).join(''),
  LEN:a=>String(one(a[0])).length,
  UPPER:a=>String(one(a[0])).toUpperCase(),
  LOWER:a=>String(one(a[0])).toLowerCase()
};
function flat(a){ const o=[]; a.forEach(v=>{ if(Array.isArray(v)) o.push(...v); else o.push(v); }); return o; }
function arr(v){ return Array.isArray(v)?v:[v]; }
function one(v){ return Array.isArray(v)?v[0]:v; }

function evalFormula(src){
  let s=String(src).trim();
  if(s.startsWith('=')) s=s.slice(1);
  if(!s) throw new Error('Enter a formula');
  let i=0;
  const ws=()=>{ while(i<s.length && /\s/.test(s[i])) i++; };
  function expr(){
    let v=term();
    ws();
    while(i<s.length && (s[i]==='+'||s[i]==='-'||s[i]==='&')){
      const op=s[i++]; const r=term();
      v = op==='&' ? String(one(v))+String(one(r)) : (op==='+'?one(v)+one(r):one(v)-one(r));
      ws();
    }
    ws();
    while(i<s.length && ['>','<','='].includes(s[i])){
      let op=s[i++]; if(s[i]==='='){op+='='; i++;} else if(op==='<'&&s[i]==='>'){op='<>'; i++;}
      const r=one(term()); const l=one(v);
      v = op==='>'?l>r: op==='<'?l<r: op==='>='?l>=r: op==='<='?l<=r: op==='<>'?l!==r: l===r;
      ws();
    }
    return v;
  }
  function term(){
    let v=factor(); ws();
    while(i<s.length && (s[i]==='*'||s[i]==='/')){
      const op=s[i++]; const r=one(factor()); const l=one(v);
      if(op==='/'&&r===0) throw new Error('#DIV/0!');
      v = op==='*'? l*r : l/r; ws();
    }
    return v;
  }
  function factor(){
    ws();
    if(s[i]==='-'){ i++; return -one(factor()); }
    if(s[i]==='+'){ i++; return one(factor()); }
    let v=atom(); ws();
    while(s[i]==='^'){ i++; v=Math.pow(one(v), one(factor())); ws(); }
    return v;
  }
  function atom(){
    ws();
    if(s[i]==='('){ i++; const v=expr(); ws(); if(s[i]!==')') throw new Error('Missing )'); i++; return v; }
    if(s[i]==='"'){ i++; let out=''; while(i<s.length&&s[i]!=='"') out+=s[i++]; i++; return out; }

    const REF=/^\$?[A-Za-z]{1,3}\$?\d+(?![A-Za-z0-9_])/;
    const rm=REF.exec(s.slice(i));
    if(rm){
      const a=rm[0]; i+=a.length;
      if(s[i]===':'){
        i++; const bm=REF.exec(s.slice(i));
        if(!bm) throw new Error('Bad range');
        const b=bm[0]; i+=b.length;
        const vals=rangeVals(a,b);
        const ma=/^\$?([A-Za-z]+)\$?(\d+)$/.exec(a), mb=/^\$?([A-Za-z]+)\$?(\d+)$/.exec(b);
        vals.__range={c1:Math.min(colIdx(ma[1]),colIdx(mb[1])),c2:Math.max(colIdx(ma[1]),colIdx(mb[1])),
                      r1:Math.min(+ma[2],+mb[2]),r2:Math.max(+ma[2],+mb[2])};
        return vals;
      }
      return cellVal(a);
    }

    const num=/^\d+(\.\d+)?/.exec(s.slice(i));
    const idm=/^[A-Za-z_][A-Za-z0-9_.]*/.exec(s.slice(i));
    if(idm && !/^\d/.test(idm[0])){
      const name=idm[0]; const after=i+name.length;
      let j=after; while(j<s.length&&/\s/.test(s[j])) j++;
      if(s[j]==='('){
        i=j+1; const args=[]; ws();
        if(s[i]===')'){ i++; } else {
          while(true){ args.push(expr()); ws();
            if(s[i]===','||s[i]===';'){ i++; continue; }
            if(s[i]===')'){ i++; break; }
            throw new Error('Bad argument list in '+name.toUpperCase());
          }
        }
        const fn=XLFN[name.toUpperCase()];
        if(!fn) throw new Error('#NAME? — '+name.toUpperCase()+' is not supported here');
        return fn(args);
      }
      if(name.toUpperCase()==='TRUE'){i+=4;return true;}
      if(name.toUpperCase()==='FALSE'){i+=5;return false;}
      throw new Error('#NAME? — '+name);
    }
    if(num){ i+=num[0].length; let v=parseFloat(num[0]); if(s[i]==='%'){i++;v/=100;} return v; }
    throw new Error('Cannot parse from: '+s.slice(i,i+14));
  }
  const out=expr(); ws();
  if(i<s.length) throw new Error('Unexpected: '+s.slice(i,i+14));
  return one(out);
}

/* ============================================================
   PYTHON — Pyodide, loaded only when asked (~15 MB)
   ============================================================ */
let pyReady=null, pyLoading=false;
function loadPy(onProgress){
  if(pyReady) return pyReady;
  pyLoading=true;
  pyReady=(async()=>{
    onProgress('Downloading Python runtime…');
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
      /* Integrity applies to injected scripts too, but only with
         crossOrigin set -- without it the browser cannot read the body to
         hash it, and silently skips the check. */
      s.integrity='sha384-tVslJOEkg7nVRW3Y3/ReGX0NnonNrbcmt1R5qFbQXQdGa2chRkoJYHAjAsv3zoTq';
      s.crossOrigin='anonymous';
      s.onload=res; s.onerror=()=>rej(new Error('Could not load Pyodide.'));
      document.head.appendChild(s);
    });
    onProgress('Starting interpreter…');
    const py=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'});
    onProgress('Loading pandas and numpy…');
    await py.loadPackage(['pandas','numpy']);
    pyLoading=false;
    return py;
  })();
  return pyReady;
}
async function runPy(code){
  const py=await pyReady;
  py.runPython(`
import sys, io
_b = io.StringIO()
sys.stdout = _b
sys.stderr = _b
`);
  let err=null;
  try{ await py.runPythonAsync(code); }catch(e){ err=String(e.message||e); }
  const out=py.runPython('sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__; _b.getvalue()');
  return {out, err};
}
