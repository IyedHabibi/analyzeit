/* ============================================================
   BENTO — a vanilla port of the MagicBento React component.

   Why a port and not the component: MagicBento needs react,
   react-dom, gsap, lucide-react, clsx and tailwind-merge. This app
   ships as one HTML file with no build step, no server and no npm
   install -- that is the property the whole project is designed
   around. Adding a React runtime to render six cards would trade
   it away for nothing the user can see.

   So every effect is reimplemented against what is already here:
   the Web Animations API instead of GSAP, CSS custom properties
   instead of Tailwind classes. Same spotlight, border glow,
   particles, tilt, magnetism and ripple; same option names.

   initBento(root, options) -> teardown()
   ============================================================ */

const BENTO_DEFAULTS = {
  enableStars:      true,
  enableSpotlight:  true,
  enableBorderGlow: true,
  enableTilt:       true,
  enableMagnetism:  true,
  clickEffect:      true,
  spotlightRadius:  300,
  particleCount:    12,
  glowColor:        '132, 0, 255',   /* RGB triplet, as in the original */
  disableAnimations:false,
  mobileBreakpoint: 768
};

/* One particle = wrapper + dot.

   The original runs two GSAP tweens on the same element: a scale/opacity
   entrance and an infinite drift. Both write `transform`, and GSAP
   reconciles that internally. The Web Animations API does not -- the
   second animation would simply replace the first. Splitting the two
   across a wrapper (drift) and a child (scale) sidesteps it entirely,
   with no compositing mode to depend on. */
function bentoParticle(x, y, color){
  const wrap = document.createElement('div');
  wrap.className = 'bento-particle';
  wrap.style.left = x + 'px';
  wrap.style.top  = y + 'px';

  const dot = document.createElement('i');
  dot.style.background = 'rgba(' + color + ', 1)';
  dot.style.boxShadow  = '0 0 6px rgba(' + color + ', .6)';
  wrap.appendChild(dot);
  return wrap;
}

function initBento(root, options){
  const o = Object.assign({}, BENTO_DEFAULTS, options || {});
  const cards = [...root.querySelectorAll('[data-bento-card]')];
  if(!cards.length) return () => {};

  const reduced = typeof REDUCED !== 'undefined' ? REDUCED.matches
                : matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Matches the original: below the breakpoint every effect is off.
     These are pointer affordances, and a touch screen has no hover. */
  const off = o.disableAnimations || reduced || innerWidth <= o.mobileBreakpoint;

  const cleanups = [];

  cards.forEach(card => {
    /* Per-card glow colour, so each track keeps its own hue. */
    const glow = card.dataset.glow || o.glowColor;
    card.style.setProperty('--bento-glow', glow);
    card.style.setProperty('--bento-radius', o.spotlightRadius + 'px');
    if(o.enableBorderGlow) card.classList.add('has-glow');

    if(off) return;

    let particles = [];
    let timers = [];
    let hovered = false;

    const clearParticles = () => {
      timers.forEach(clearTimeout);
      timers = [];
      particles.forEach(p => {
        const a = p.animate([{opacity:1, transform:'scale(1)'}, {opacity:0, transform:'scale(0)'}],
          {duration:260, easing:'cubic-bezier(.36,0,.66,-.56)', fill:'forwards'});
        a.onfinish = () => p.remove();
      });
      particles = [];
    };

    const spawnParticles = () => {
      const {width, height} = card.getBoundingClientRect();
      for(let i = 0; i < o.particleCount; i++){
        timers.push(setTimeout(() => {
          if(!hovered) return;
          const p = bentoParticle(Math.random() * width, Math.random() * height, glow);
          card.appendChild(p);
          particles.push(p);

          p.firstChild.animate([{transform:'scale(0)', opacity:0}, {transform:'scale(1)', opacity:1}],
            {duration:300, easing:'cubic-bezier(.34,1.56,.64,1)', fill:'forwards'});

          p.animate([
            {transform:'translate(0,0) rotate(0deg)'},
            {transform:`translate(${(Math.random()-.5)*100}px, ${(Math.random()-.5)*100}px) rotate(${Math.random()*360}deg)`}
          ], {duration:2000 + Math.random()*2000, easing:'linear', iterations:Infinity, direction:'alternate'});
        }, i * 100));
      }
    };

    /* Tilt and magnetism both write `transform`, so they are composed
       into one string rather than fighting over the property. */
    let rx = 0, ry = 0, tx = 0, ty = 0;
    const paint = () => {
      card.style.transform =
        `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
    };

    const onEnter = () => {
      hovered = true;
      card.classList.add('is-hot');
      if(o.enableStars) spawnParticles();
    };

    const onLeave = () => {
      hovered = false;
      card.classList.remove('is-hot');
      clearParticles();
      rx = ry = tx = ty = 0;
      card.style.transform = '';
    };

    const onMove = e => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const cx = r.width / 2, cy = r.height / 2;

      if(o.enableSpotlight || o.enableBorderGlow){
        card.style.setProperty('--bento-x', x + 'px');
        card.style.setProperty('--bento-y', y + 'px');
      }
      if(o.enableTilt){
        rx = ((y - cy) / cy) * -8;
        ry = ((x - cx) / cx) *  8;
      }
      if(o.enableMagnetism){
        tx = (x - cx) * 0.05;
        ty = (y - cy) * 0.05;
      }
      if(o.enableTilt || o.enableMagnetism) paint();
    };

    const onClick = e => {
      if(!o.clickEffect) return;
      const r = card.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'bento-ripple';
      ripple.style.left = (e.clientX - r.left) + 'px';
      ripple.style.top  = (e.clientY - r.top)  + 'px';
      ripple.style.background = 'rgba(' + glow + ', .5)';
      card.appendChild(ripple);
      const a = ripple.animate([{transform:'scale(0)', opacity:1}, {transform:'scale(50)', opacity:0}],
        {duration:800, easing:'cubic-bezier(.22,1,.36,1)', fill:'forwards'});
      a.onfinish = () => ripple.remove();
    };

    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mouseleave', onLeave);
    card.addEventListener('mousemove',  onMove);
    card.addEventListener('click',      onClick);

    cleanups.push(() => {
      card.removeEventListener('mouseenter', onEnter);
      card.removeEventListener('mouseleave', onLeave);
      card.removeEventListener('mousemove',  onMove);
      card.removeEventListener('click',      onClick);
      clearParticles();
      card.style.transform = '';
    });
  });

  return () => cleanups.forEach(fn => fn());
}
