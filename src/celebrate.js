/* ============================================================
   SUCCESS — delight as the result of getting the rest right,
   not confetti tacked on.

   Three senses fire on the SAME frame (causality + harmony):
   the seal springs in, the check draws itself, the device taps.
   Reserved for a first correct answer only — celebrating every
   re-check would train you to ignore it (utility).
   ============================================================ */
function celebrate(msg, sub){
  const host = document.getElementById('verdict');
  if(!host) return;
  const done = doneCount();
  host.className = 'verdict pass';
  host.innerHTML = `
    <div class="cel">
      <div class="cel-seal" id="celSeal">
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <circle class="cel-ring" cx="22" cy="22" r="19"/>
          <path class="cel-tick" d="M13 22.5l6 6 12-13"/>
        </svg>
      </div>
      <div class="cel-txt">
        <b>${msg}</b>
        <span>${sub}</span>
      </div>
    </div>`;

  /* open the container first so nothing below jumps */
  host.style.height='auto'; const h=host.scrollHeight; host.style.height='0px';
  if(!host._sp) host._sp=new Spring(0,{damping:1.0,response:0.36,
    onFrame:x=>{host.style.height=Math.max(0,x)+'px'; host.style.opacity=Math.min(1,x/Math.max(h*.5,1));}});
  host._sp.to(h);

  if(REDUCED.matches){
    const s=document.getElementById('celSeal');
    if(s){ s.style.transform='scale(1)'; s.style.opacity='1';
      const p=s.querySelector('.cel-tick'); if(p) p.style.strokeDashoffset='0'; }
    return;
  }

  const seal=document.getElementById('celSeal');
  const tick=seal && seal.querySelector('.cel-tick');
  const len = tick ? tick.getTotalLength ? tick.getTotalLength() : 30 : 30;
  if(tick){ tick.style.strokeDasharray=len; tick.style.strokeDashoffset=len; }

  /* the seal arrives with a little bounce — earned, because this
     is a moment of achievement, not an idle state change */
  /* Starts at 0.62, not 0: nothing in the real world appears from
     nothing, and a seal that pops out of a zero-width point reads as
     a glitch rather than an arrival. The bounce stays -- it is earned. */
  new Spring(0.62,{damping:0.72,response:0.42,
    onFrame:v=>{ if(!seal) return;
      seal.style.transform='scale('+v.toFixed(3)+')';
      seal.style.opacity=Math.min(1,v*1.6).toFixed(3);
      if(tick) tick.style.strokeDashoffset=(len*Math.max(0,1-(v-0.35)/0.6)).toFixed(2);
    }}).to(1);

  /* same frame as the visual, not after it */
  try{ if(navigator.vibrate) navigator.vibrate(done%3===0?[12,40,18]:12); }catch(e){}
}

/* Ticks in the sidebar and the progress grid spring in rather
   than appearing, so you can see which one just changed. */
function popTick(el){
  if(!el || REDUCED.matches) return;
  new Spring(0.4,{damping:0.68,response:0.36,
    onFrame:v=>el.style.transform='scale('+v.toFixed(3)+')'}).to(1);
}
