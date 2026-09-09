/* ============================================================
   MOTION — springs parameterised the way Apple parameterises
   them: damping ratio + response, not mass/stiffness/damping.

   The reason this is a spring and not a CSS transition: a
   transition cannot be grabbed mid-flight. A spring animates
   from its *current* value and carries its *current* velocity
   through a re-target, so reversing a gesture never produces
   the velocity discontinuity that reads as a brick wall.
   ============================================================ */
const REDUCED = (typeof matchMedia === 'function')
  ? matchMedia('(prefers-reduced-motion: reduce)')
  : {matches:false, addEventListener(){}, addListener(){}};

class Spring {
  constructor(value, {damping = 1.0, response = 0.4, onFrame, onRest} = {}){
    this.v = value; this.target = value; this.vel = 0;
    this.damping = damping; this.response = response;
    this.onFrame = onFrame; this.onRest = onRest;
    this.raf = null; this.running = false;
  }
  get omega(){ return (2 * Math.PI) / this.response; }
  /* Re-target WITHOUT resetting velocity — this is what makes a
     reversal continuous instead of a hard cut. */
  to(target, {velocity, damping, response} = {}){
    this.target = target;
    if(velocity !== undefined) this.vel = velocity;
    if(damping !== undefined) this.damping = damping;
    if(response !== undefined) this.response = response;
    if(REDUCED.matches){ this.set(target); return this; }
    this.start(); return this;
  }
  /* Jump with no motion — used for 1:1 drag tracking, where the
     value must be exactly the finger, not a spring chasing it. */
  set(value){
    this.stop(); this.v = value; this.target = value; this.vel = 0;
    this.onFrame && this.onFrame(this.v); return this;
  }
  /* Feed live velocity in while dragging so release can hand off. */
  track(value, vel){
    this.stop(); this.v = value; this.vel = vel || 0;
    this.onFrame && this.onFrame(this.v); return this;
  }
  start(){
    if(this.running) return;
    this.running = true;
    let last = performance.now();
    const step = now => {
      const dt = Math.min((now - last) / 1000, 1/20); last = now;
      this.advance(dt);
      this.onFrame && this.onFrame(this.v);
      if(Math.abs(this.vel) < 0.06 && Math.abs(this.v - this.target) < 0.06){
        this.v = this.target; this.vel = 0; this.running = false; this.raf = null;
        this.onFrame && this.onFrame(this.v);
        this.onRest && this.onRest();
        return;
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  /* Closed-form solution, not numerical integration. Euler at a
     real 60Hz frame silently ate ~92% of the overshoot at damping
     0.8 — the bounce vanished on actual hardware, and a 120Hz
     display behaved differently from a 60Hz one. This is exact
     and frame-rate independent. */
  advance(dt){
    const w = this.omega, z = this.damping;
    const x0 = this.v - this.target, v0 = this.vel;
    let x, v;
    if(z < 1){
      const wd = w * Math.sqrt(1 - z*z);
      const e = Math.exp(-z * w * dt);
      const c = Math.cos(wd * dt), s = Math.sin(wd * dt);
      const A = x0, B = (v0 + z*w*x0) / wd;
      x = e * (A*c + B*s);
      v = e * ((B*wd - z*w*A)*c - (A*wd + z*w*B)*s);
    } else if(z === 1){
      const e = Math.exp(-w * dt), k = v0 + w*x0;
      x = (x0 + k*dt) * e;
      v = (v0 - w*k*dt) * e;
    } else {
      const r = w * Math.sqrt(z*z - 1);
      const r1 = -z*w + r, r2 = -z*w - r;
      const c2 = (v0 - r1*x0) / (r2 - r1), c1 = x0 - c2;
      const e1 = Math.exp(r1*dt), e2 = Math.exp(r2*dt);
      x = c1*e1 + c2*e2;
      v = c1*r1*e1 + c2*r2*e2;
    }
    this.v = this.target + x;
    this.vel = v;
  }
  stop(){ if(this.raf) cancelAnimationFrame(this.raf); this.raf=null; this.running=false; return this; }
}

/* Apple's momentum projection (Designing Fluid Interfaces sample
   code). Not the textbook v²/2a — the exponential-decay form. */
function project(velocity, decel = 0.998){
  return (velocity / 1000) * decel / (1 - decel);
}

/* Progressive resistance past a boundary. A hard stop reads as
   frozen; resistance reads as "responsive, nothing more here". */
function rubberband(overshoot, dimension, c = 0.55){
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}

/* Velocity from a short history, not the last two points — one
   stray sample at release otherwise throws the whole handoff. */
class Tracker {
  constructor(){ this.pts = []; }
  add(x, y){
    const t = performance.now();
    this.pts.push({x, y, t});
    while(this.pts.length > 6 || (this.pts.length > 2 && t - this.pts[0].t > 110)) this.pts.shift();
  }
  velocity(axis = 'x'){
    if(this.pts.length < 2) return 0;
    const a = this.pts[0], b = this.pts[this.pts.length - 1];
    const dt = (b.t - a.t) / 1000;
    if(dt <= 0) return 0;
    return (b[axis] - a[axis]) / dt;
  }
  reset(){ this.pts = []; }
}

/* Press feedback fires on pointerdown. Waiting for click feels
   dead — and dragging away must cancel it, then coming back
   must restore it. */
function wirePress(root){
  root.addEventListener('pointerdown', e => {
    const el = e.target.closest('.pressable');
    if(!el) return;
    el.dataset.press = '1';
    const clear = () => { delete el.dataset.press;
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear); };
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
  }, {passive:true});
}

/* Height animation for disclosure — springs the measured height,
   never a fixed-duration max-height guess. */
function springHeight(el, open){
  const target = open ? el.scrollHeight : 0;
  if(!el._sp){
    el._sp = new Spring(el.getBoundingClientRect().height, {
      damping:1.0, response:0.34,
      onFrame:v => { el.style.height = Math.max(0, v) + 'px'; }
    });
  }
  el.style.overflow = 'hidden';
  el._sp.to(target);
  el._sp.onRest = () => { if(open) el.style.height = 'auto'; };
}
