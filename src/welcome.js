/* ============================================================
   HOME — vertical, scroll-revealed, ending in a choice.

   Replaces the horizontal ticker. That version laid the whole
   pitch out as one long sentence in a single flex row and drove
   it sideways from scrollTop, which made two problems that were
   structural rather than tunable:

     - Scroll length was `viewport + row.scrollWidth`. The row was
       one very long sentence, so finishing it took a great many
       wheel turns. Shortening the copy was the only lever.
     - Words moved sideways under a vertical gesture. The wheel
       says "down", the text goes "left", and every line is in
       motion while you are trying to read it.

   This version scrolls the way the gesture means. Sections are
   viewport-height, type is large and still, and each section
   fades and rises once as it arrives -- an entrance, not a
   scrub, so nothing moves while you read it. It ends on the
   question the whole page exists to ask: which skill first.

   Reveals use IntersectionObserver against the .scrolldeck
   scroller. Deliberately NOT ScrollTrigger: pinning inside this
   custom fixed scroller needs scrollerProxy, and that indirection
   lags the true scroll position -- the bug this file already
   carries a warning about.
   ============================================================ */

var wObs = null, wBentoOff = null;

function renderWelcome(){
  paintTrack('sql');
  document.documentElement.classList.add('label-mode');
  deck.innerHTML = '';

  let host = document.getElementById('sdeck'); if(host) host.remove();
  host = document.createElement('div'); host.className = 'scrolldeck'; host.id = 'sdeck';
  document.body.appendChild(host);

  const solved = exSolvedTotal(), TOT = EX_TOTAL(), LES = LESSON_TOTAL(), AUTO = AUTO_CHECKED();
  const names = TRACKS.map(t => t.name);
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names.at(-1) : names[0];
  /* The hero CTA goes to the first unsolved exercise of the first enabled
     track, so it lands somewhere real rather than on a marketing anchor --
     and it keeps working if the track lineup changes. */
  const ctaTrack = TRACKS[0];

  /* One card per track, all the same size. An asymmetric bento made the
     tracks look ranked, which they are not -- this is a choice between
     equals, so they get equal weight and a single aligned row.
     --i drives the staggered entrance. */
  const trackCards = TRACKS.map((t, i) => {
    const done = [0,1,2].reduce((a, l) => a + exCount(t.id, l), 0);
    /* Derived, not 9. The bank is no longer three per lesson, and a
       hardcoded denominator here would quietly under-report every
       track the moment content was added. */
    const tot  = [0,1,2].reduce((a, l) => a + exList(t.id, l).length, 0);
    const pct  = Math.round(done / Math.max(1, tot) * 100);
    return `
      <button class="bento-card" data-bento-card
              data-glow="var-${t.id}" style="--tg:var(--${t.id});--i:${i}"
              data-go="${t.id}:${firstUnsolved(t.id)}"
              aria-label="Start ${t.name}">
        <span class="bento-spot" aria-hidden="true"></span>
        <span class="bento-edge" aria-hidden="true"></span>
        <span class="bento-top">
          <span class="bento-gy">${GY(t.id)}</span>
          <span class="lbl">${t.auto ? 'auto-checked' : 'written answer'}</span>
        </span>
        <span class="bento-mid">
          <span class="bento-name dsp">${t.name}</span>
          <span class="bento-blurb">${t.blurb}</span>
        </span>
        <span class="bento-foot">
          <span class="bento-meter"><i style="width:${pct}%"></i></span>
          <span class="bento-count">${done}/${tot}</span>
        </span>
      </button>`;
  }).join('');

  host.innerHTML = `
  <div class="grain" aria-hidden="true"></div>

  <nav class="lnav" id="lnav">
    <span class="lmark" aria-hidden="true"></span>
    <span class="lwm">${BRAND}</span>
    <span class="sp"></span>
    <button class="lthm" id="lthemebtn" aria-label="Switch appearance">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.6v10.8a5.4 5.4 0 010-10.8z"/></svg>
    </button>
    <button class="lpill" data-go="sql:0">Start</button>
  </nav>

  <section class="vs vs-hero">
    <div class="vin" id="heroIn">
      <!-- Per-letter mask reveal: each outer span is a clipping window, the
           inner span rises through it. Transform-only inside a mask, so it
           stays on the GPU; no clip-path needed. The letters are hidden from
           assistive tech and the name is restored by aria-label, or it would
           be announced letter by letter. -->
      <h1 class="bigmark rv" data-rv data-delay="0" aria-label="${BRAND}">
        ${BRAND.split('').map((c, i) =>
          `<span class="ltr" aria-hidden="true" style="--i:${i}"><span>${c}</span></span>`
        ).join('')}
      </h1>

      <p class="vstate rv" data-rv data-delay="1240">Learn ${list} by <em>writing</em> them — not by watching someone else.</p>

      <p class="vlede rv" data-rv data-delay="1540">Built for students, career-switchers, and anyone curious enough to open the door.
        No degree, no setup, no credit card &mdash; just a free account so your progress
        follows you. The database and the runtimes are already here, in this page.</p>

      <!-- The hero had no call to action at all: ctaTrack was computed and
           never used, and the .vcta / .btn-hero styles had no markup to
           attach to. The only way in was the small Start in the nav, which
           is why the page read as flat. This lands on the first UNSOLVED
           exercise of the first track, so it is a real destination rather
           than an anchor.
           NOTE: no backticks in comments inside this template literal --
           they close the string. That is exactly how this shipped broken. -->
      <div class="vcta rv" data-rv data-delay="1780">
        <button class="btn-hero pressable" data-go="${ctaTrack.id}:${firstUnsolved(ctaTrack.id)}">
          Start with ${ctaTrack.name}
        </button>
        <span class="vcta-note">${TOT} exercises &middot; ${AUTO} auto-checked &middot; free</span>
      </div>

    </div>

    <div class="vcue rv" data-rv>
      <span>Scroll</span>
      <svg aria-hidden="true" focusable="false" width="10" height="30" viewBox="0 0 10 30" fill="none" stroke="currentColor"
           stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 1v24m-4-6 4 6 4-6"/></svg>
    </div>
  </section>

  <!-- HOW IT WORKS -- replaces the three narrative sections.
       A zig-zag, not a row of three equal cards: equal columns are the
       most generic possible feature row, and alternating sides gives the
       eye somewhere to travel. Every panel is a replica of the real UI,
       built from markup rather than a screenshot: sharp at any density,
       correct in both themes, and a few hundred bytes instead of a few
       hundred thousand. The content is real -- the same query, rows and
       verdict string the app itself produces. -->
  <section class="vs vs-how">
    <div class="vin wide">
      <p class="lbl rv" data-rv>How it works</p>
      <h2 class="dsp vbig rv" data-rv>Three steps,<br>then you are working.</h2>

      <ol class="steps">
        <li class="step rv" data-rv>
          <div class="step-txt">
            <span class="step-n">01</span>
            <h3>You get the request, not a lecture</h3>
            <p>Every exercise opens the way work actually arrives: someone needs numbers, and the
              rows are right there in front of you.</p>
          </div>
          <figure class="uishot" data-fig="Fig. 1 — the brief, as it arrives." role="img" aria-label="A lesson brief: a manager asks for everyone in the Data team earning over 80,000, with the task stated underneath.">
            <div class="us-bar"><i class="us-dot"></i>lesson<span class="us-sp"></span><span class="us-tag">SQL · Beginner</span></div>
            <div class="us-body">
              <div class="us-quote">Can you send me everyone in the Data team earning over 80k?
                Need it before the 2pm call.</div>
              <div class="us-task"><b>Your turn.</b> Return <code>name</code> and <code>salary</code>
                for the Data department above 80000, highest first.</div>
            </div>
          </figure>
        </li>

        <li class="step rv" data-rv>
          <div class="step-txt">
            <span class="step-n">02</span>
            <h3>You write it and run it</h3>
            <p>A real SQLite database and a real Python runtime load inside the page. Press Run and
              the rows come back — yours, not a recording of someone else's.</p>
          </div>
          <figure class="uishot" data-fig="Fig. 2 — the editor, mid-query, with the rows it returned." role="img" aria-label="The editor with a SQL query typed in, a Run button, and the result rows returned underneath.">
            <div class="us-bar"><i class="us-dot"></i>query.sql<span class="us-sp"></span><span class="us-tag">sqlite · wasm</span></div>
            <pre class="us-code"><span class="k">SELECT</span> name, salary <span class="k">FROM</span> employees
<span class="k">WHERE</span> department = <span class="s">'Data'</span> <span class="k">AND</span> salary &gt; <span class="n">80000</span>
<span class="k">ORDER BY</span> salary <span class="k">DESC</span>;<span class="us-caret"></span></pre>
            <div class="us-acts"><span class="us-btn pri">Run</span><span class="us-btn">Check answer</span></div>
            <table class="us-out">
              <tr><th>name</th><th class="r">salary</th></tr>
              <tr><td>Mei Chen</td><td class="r">118000</td></tr>
              <tr><td>Luca Ferrari</td><td class="r">96000</td></tr>
              <tr><td>Amira Haddad</td><td class="r">82000</td></tr>
            </table>
          </figure>
        </li>

        <li class="step rv" data-rv>
          <div class="step-txt">
            <span class="step-n">03</span>
            <h3>It tells you, straight away</h3>
            <p>Your result is compared against a correct one, row by row — no self-marking. Wrong
              answers say what is off, so the next attempt is informed rather than a guess.</p>
          </div>
          <figure class="uishot" data-fig="Fig. 3 — two verdicts: one correct, one explained." role="img" aria-label="Two verdicts: one correct, and one explaining that the row count does not match.">
            <div class="us-bar"><i class="us-dot"></i>result<span class="us-sp"></span><span class="us-tag">checked</span></div>
            <div class="us-body">
              <div class="us-verdict ok"><i></i><span><b>Correct.</b> 3 rows, matching values and order.</span></div>
              <div class="us-verdict bad"><i></i><span><b>Not matching yet.</b> You returned 5 rows; the answer has 3.</span></div>
              <div class="us-hint">Hint · Two conditions joined by AND, then ORDER BY … DESC.</div>
            </div>
          </figure>
        </li>
      </ol>
    </div>
  </section>

  <section class="vs vs-pick">
    <div class="vin wide">
      <aside class="marg rv" data-rv><b>Contents</b>Four tracks. Start anywhere;
        nothing is locked and nothing has to be done in order.</aside>
      <p class="lbl a rv" data-rv>Pick one</p>
      <h2 class="dsp vbig rv" data-rv>Where do you<br>want to start?</h2>
      <div class="bento-grid rv" data-rv id="bentoGrid">${trackCards}</div>
      <p class="vfine rv" data-rv>
        ${solved ? solved + ' of ' + TOT + ' solved so far — pick up anywhere. ' : ''}
        ${MANUAL_TRACKS().length
          ? nameList(MANUAL_TRACKS()) + (MANUAL_TRACKS().length === 1 ? ' has' : ' have') +
            ' no browser runtime here, so those exercises are written answers compared against worked solutions.'
          : 'Every exercise here executes for real in your browser.'}
      </p>
    </div>
  </section>

  <footer class="vfoot">
    <div class="vwm">${BRAND}</div>
    <div class="vfoot-meta">
      ${LES} lessons · ${TOT} exercises · ${AUTO} auto-checked<br>
      Progress syncs to your account. No tracking, no analytics, nothing sold.
    </div>
  </footer>

  <footer class="sitefoot">
    <span class="fmark" aria-hidden="true"></span>
    <span class="sf-by"><i>Built by</i> <b>Iyed Habibi</b></span>
    <nav class="sf-links" aria-label="Author and policy links">
      <!-- A privacy policy nobody can reach does not discharge the
           obligation. These point at the repo because the app ships as one
           HTML file and has no routes of its own; that is a real page a
           person can read, which is what the requirement actually asks for. -->
      <a href="https://github.com/IyedHabibi/analyzeit/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">Privacy</a>
      <a href="https://github.com/IyedHabibi/analyzeit/blob/main/TERMS.md" target="_blank" rel="noopener noreferrer">Terms</a>
      <a href="https://github.com/IyedHabibi" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>GitHub</a>
      <a href="https://www.linkedin.com/in/iyed-habibi-4bbb4128a/" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg>LinkedIn</a>
    </nav>
  </footer>`;

  /* The home deck covers the app header at z-index 90, so the header's
     theme button is unreachable from here. Rather than a second copy of
     the toggle logic -- which would drift from the original the first
     time either changed -- this forwards the click to that button, so
     there stays exactly one implementation of what switching theme means. */
  const lt = document.getElementById('lthemebtn');
  if(lt) lt.onclick = () => {
    const hdr = document.getElementById('theme');
    if(hdr) hdr.click();
  };

  wireReveals(host);
}

function wireReveals(sd){
  const items = [...sd.querySelectorAll('[data-rv]')];
  const showAll = () => items.forEach(el => el.classList.add('in'));

  /* Reduced motion gets the finished page, never a blank one waiting
     for an animation to run. */
  if(REDUCED.matches){
    showAll();
    wireBento(sd, true);
    return;
  }

  /* IntersectionObserver drives this, per the design protocol, which is
     right about the general case: nothing should hang work off a scroll
     event.

     But IO alone is not safe here, and that is not theoretical. IO is
     driven by the rendering lifecycle, so an occluded or backgrounded
     window starves it -- verified on this machine, where a freshly
     built observer reported zero intersections for an element sitting
     at top 201 in a 720px viewport, and the page rendered blank below
     the hero with every element present. Scroll events and rAF are
     starved in the same conditions, so neither is a fallback for the
     other.

     Timers are not. So: IO does the work, and a slow poll guarantees
     that anything actually on screen gets revealed regardless of what
     the compositor is doing. The poll stops as soon as everything is
     in, which on a normal read is a second or two.

     Content must never depend on an animation to become visible. */
  sd.classList.add('rv-on');

  let pending = items.slice();
  const reveal = () => {
    if(!pending.length) return;
    const h = sd.clientHeight || innerHeight;
    const line = h * 0.88;          /* fire a little before the element is centred */
    const perSection = new Map();
    pending = pending.filter(el => {
      const r = el.getBoundingClientRect();
      /* The hero is above the fold by definition, so it is never subject to
         the trigger line. This matters for the scroll cue, which is anchored
         to the bottom of the section: its top sits below the line, so it
         would sit hidden forever and the page would never say "scroll". */
      const inHero = !!el.closest('.vs-hero');
      if(!inHero && (r.top >= line || r.bottom <= -80)) return true;
      /* Stagger within a section so a heading lands before its body. */
      const sec = el.closest('.vs');
      const n = perSection.get(sec) || 0;
      perSection.set(sec, n + 1);
      /* An explicit data-delay wins over the section stagger. The hero uses
         it so the wordmark lands on its own -- its letters take about a
         second to settle -- before the lines beneath arrive one at a time.
         A uniform 70ms stagger would run all three together. */
      el.style.transitionDelay = (el.dataset.delay !== undefined
        ? el.dataset.delay : n * 70) + 'ms';
      el.classList.add('in');
      return false;
    });
  };

  /* Scroll-linked chrome: the hero drifts and fades as it leaves, the nav
     condenses, and the track cards part slightly for depth. All of it is
     written straight from scrollTop -- the same model the old ticker used,
     and the reason ScrollTrigger is not welcome here. Transform and opacity
     only, so this stays on the compositor. */
  const nav    = sd.querySelector('#lnav');
  const cards  = [...sd.querySelectorAll('#bentoGrid [data-bento-card]')];
  const pickIn = sd.querySelector('.vs-pick');

  const parallax = () => {
    const y = sd.scrollTop;

    /* No hero fade-out. It was written for a full-viewport cinematic
       hero, where a screen of scrolling faded it as it left. Under the
       macro-whitespace layout the hero is far shorter than the viewport,
       so the same formula erased it after 200px of scroll -- measured at
       opacity 0.12 with the hero still on screen. The protocol asks for
       scroll ENTRY fades, not a departure fade, and for motion that goes
       unnoticed. Removing it is the fix, not retuning the constant. */
    if(nav) nav.classList.toggle('tight', y > 60);

    /* Cards drift in alternating directions, clamped so they never
       separate enough to break the row's alignment. */
    if(cards.length && pickIn){
      const r = pickIn.getBoundingClientRect();
      const centred = (sd.clientHeight / 2 - (r.top + r.height / 2)) / sd.clientHeight;
      const d = Math.max(-1, Math.min(1, centred)) * 14;
      cards.forEach((c, i) => { c.style.setProperty('--drift', ((i % 2 ? -d : d)).toFixed(1) + 'px'); });
    }
  };

  /* Primary mechanism: one observer, unobserving each element as it
     lands so it stops costing anything. */
  let io = null;
  if(typeof IntersectionObserver !== 'undefined'){
    io = new IntersectionObserver((entries, obs) => {
      let hit = false;
      entries.forEach(e => { if(e.isIntersecting){ hit = true; obs.unobserve(e.target); } });
      if(hit) reveal();
    }, {root: sd, rootMargin: '0px 0px -12% 0px', threshold: 0.01});
    items.forEach(el => io.observe(el));
  }

  /* parallax still needs the scroll position itself -- there is no
     observer for "how far down are we", and it is transform-only. */
  const onScroll = () => { reveal(); parallax(); };
  sd.addEventListener('scroll', onScroll, {passive: true});
  addEventListener('resize', onScroll);
  parallax();

  /* Local time. No city label: the reference hardcodes one, and inventing
     a location is exactly what the guardrails rule out. */
  const clock = sd.querySelector('#vclock');
  const tick = () => {
    if(!clock) return;
    clock.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  };
  tick();
  const clockTimer = setInterval(tick, 30000);

  reveal();                  /* the hero, which is already on screen */
  setTimeout(reveal, 60);    /* again once layout and fonts have settled */

  /* Safety net. Scroll events are themselves dispatched during the
     rendering steps, so an occluded window starves them exactly like
     it starves IntersectionObserver and rAF -- verified here, the page
     stayed blank below the hero. Timers keep running regardless, so a
     slow poll guarantees anything actually on screen gets revealed no
     matter what the compositor is doing. It stops as soon as every
     item is in, which on a normal read is a second or two. */
  const poll = setInterval(() => {
    reveal();
    if(!pending.length) clearInterval(poll);
  }, 400);

  /* Kept as an object with disconnect() so teardownWelcome(), which
     already calls wObs.disconnect(), needs no change. */
  wObs = {
    disconnect(){
      if(io) io.disconnect();
      clearInterval(poll);
      clearInterval(clockTimer);
      sd.removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
    }
  };

  wireBento(sd, false);
}

function wireBento(sd, reduced){
  const grid = sd.querySelector('#bentoGrid');
  if(!grid) return;
  /* Each card carries data-glow="var-<track>"; resolve it to the real
     RGB triplet the effects need, from the computed track colour. */
  grid.querySelectorAll('[data-bento-card]').forEach(card => {
    const id = (card.dataset.glow || '').replace(/^var-/, '');
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--' + id).trim();
    card.dataset.glow = hexToRgbTriplet(hex) || '132, 0, 255';
  });
  if(wBentoOff) wBentoOff();
  wBentoOff = initBento(grid, {disableAnimations: reduced, particleCount: 10, spotlightRadius: 320});
}

/* #RGB / #RRGGBB -> "r, g, b". The effects build rgba() strings, so a
   hex value straight from a custom property will not do. */
function hexToRgbTriplet(hex){
  if(!hex) return null;
  let h = hex.replace('#', '').trim();
  if(h.length === 3) h = h.split('').map(c => c + c).join('');
  if(h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function teardownTicker(){
  if(wObs){ try{ wObs.disconnect(); }catch(e){} wObs = null; }
  if(wBentoOff){ try{ wBentoOff(); }catch(e){} wBentoOff = null; }
}
