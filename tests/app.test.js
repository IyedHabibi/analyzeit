/* Rendered-app tests. Run against a real browser inside an iframe, so
   getComputedStyle reflects an actual layout engine rather than jsdom's
   approximation.

   The lesson recorded in HANDOFF.md: an early build shipped a blank home
   page while every structural test passed, because the elements existed
   and answered to clicks -- they were merely invisible. So the first
   assertion here is visibility, and `visible()` walks ancestors rather
   than trusting the element's own style. */

const AT = [];
const atest = (name, fn) => AT.push({name, fn, phase:'app'});
/* Phase matters: before teardownWelcome() the ticker is up and main is
   deliberately hidden, so welcome-phase and app-phase assertions cannot
   share a moment in time. The runner tears down between the two and
   waits for the entrance animation to finish -- an element that is
   invisible for 300ms mid-fade is not the bug being guarded against,
   but one that stays invisible still fails. */
const wtest = (name, fn) => AT.push({name, fn, phase:'welcome'});
function aassert(cond, msg){ if(!cond) throw new Error(msg); }

let W, D;   /* iframe window / document, set by the runner */

/* The app's top-level `const`/`let` bindings are script-scoped, not
   properties of window -- only `function` declarations land on window.
   So reading TRACKS/EX/state from outside the frame needs eval inside
   it. Getting this wrong reads as "the app is broken" when it is not. */
const G = expr => W.eval(expr);

/* Leaf elements whose rendered text matches, excluding elements that are
   not rendered text at all. This matters: in the BUILT single file the
   scripts are inline, so their source -- which legitimately contains
   `typeof x !== 'undefined'` -- becomes matching textContent and reports
   three false positives. In dev.html the scripts are external and it
   never shows up. That is exactly the kind of gap that lets a suite pass
   on the dev entry point and fail on the artifact you actually ship. */
const NOT_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE']);
function textHits(re){
  return [...D.querySelectorAll('body *')]
    .filter(el => !el.children.length && !NOT_TEXT.has(el.tagName) && re.test(el.textContent))
    .map(el => el.tagName + ': ' + el.textContent.trim().slice(0, 60));
}

/* An element is visible only if it and every ancestor is. Checking the
   element alone is exactly the hole the blank-page bug went through. */
function visible(el){
  if(!el) return false;
  let n = el;
  while(n && n.nodeType === 1){
    const cs = W.getComputedStyle(n);
    if(cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    n = n.parentElement;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

wtest('the app paints something -- body has real size and a background', () => {
  const cs = W.getComputedStyle(D.body);
  aassert(D.body.getBoundingClientRect().height > 100, 'body has no height');
  aassert(cs.backgroundColor !== 'rgba(0, 0, 0, 0)', 'body has no background colour');
});

wtest('the welcome screen renders visible content before anything is clicked', () => {
  /* On first load the home page is up and `body.locked main{visibility:hidden}`
     hides main by design -- so assert the home page, not the deck. Asserting
     the wrong one here is how a test reports a working app as broken. */
  const intro = D.querySelector('#sdeck .vs-hero');
  aassert(intro, 'no home page section found');
  aassert(visible(intro), 'the welcome screen is not visible');
  aassert(D.body.textContent.trim().length > 100, 'welcome screen has almost no text');
});

wtest('home content is never left hidden waiting on an animation', () => {
  /* The reveal hides [data-rv] items until they scroll in. If whatever
     drives that stops running -- an occluded window starves rAF,
     IntersectionObserver AND scroll events, which is why this is a
     poll -- the page would render blank with all its content present.
     Assert the hero specifically has been revealed. */
  const heroItems = [...D.querySelectorAll('#sdeck .vs-hero [data-rv]')];
  aassert(heroItems.length > 0, 'hero has no revealable items');
  aassert(heroItems.every(el => el.classList.contains('in')),
    'hero items are still hidden: ' + heroItems.filter(e => !e.classList.contains('in')).length + ' of ' + heroItems.length);
});

wtest('the hero survives being scrolled', () => {
  /* A hero fade-out written for a 100vh cinematic hero erased this one
     after 200px of scroll -- measured at opacity 0.12 with the hero still
     fully on screen -- because the macro-whitespace layout makes the hero
     far shorter than the viewport. Assert the hero stays legible at a
     scroll depth a reader reaches immediately. */
  const sd = D.getElementById('sdeck');
  const hero = D.querySelector('#sdeck .vs-hero');
  const before = sd.scrollTop;
  sd.scrollTop = 200;
  let op = 1, n = hero;
  while(n && n !== sd){ op *= parseFloat(W.getComputedStyle(n).opacity); n = n.parentElement; }
  sd.scrollTop = before;
  aassert(op > 0.9, `hero faded to ${op.toFixed(2)} after 200px of scroll`);
});

wtest('body copy clears the contrast floor on the warm canvas', () => {
  /* A light warm palette is where muted greys quietly fail. Check the
     real pairing rather than trusting the token values. */
  const sd = D.getElementById('sdeck');
  const paper = W.getComputedStyle(sd).backgroundColor;
  const lum = c => { const p = c.match(/[\d.]+/g).slice(0,3).map(Number).map(v => {
    v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*p[0] + 0.7152*p[1] + 0.0722*p[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b);
    return (Math.max(x,y) + 0.05) / (Math.min(x,y) + 0.05); };
  [['.vlede', 4.5], ['.bigmark', 4.5], ['.vcta-note', 4.5]].forEach(([sel, min]) => {
    const el = sd.querySelector(sel);
    if(!el) return;
    const r = ratio(W.getComputedStyle(el).color, paper);
    aassert(r >= min, `${sel} is ${r.toFixed(2)}:1 against the canvas, needs ${min}`);
  });
});

wtest('unused imagery is not shipped', () => {
  /* The print direction uses no photography -- paper, ink and rules instead.
     Any image still embedded would ride along in every copy of the file and
     never draw a pixel. Assert what the page actually renders: if a section
     declares a photo it must resolve, and if none do, none should be
     embedded. This caught 385KB of dead weight across two design changes. */
  const shots = [...D.querySelectorAll('#sdeck .vs[data-photo]')];
  const hero = D.querySelector('#sdeck .hero-atmo');
  shots.forEach(s => {
    const cs = W.getComputedStyle(s, '::before');
    aassert(cs.backgroundImage.startsWith('url('),
      `section ${s.dataset.photo} declares a photo that did not resolve`);
    aassert(cs.backgroundRepeat === 'no-repeat',
      `section ${s.dataset.photo} would tile`);
    aassert(W.getComputedStyle(s).overflow === 'hidden',
      `section ${s.dataset.photo} does not clip its scaled background`);
  });
  const ids = shots.map(s => s.dataset.photo);
  aassert(new Set(ids).size === ids.length, 'a photo is used twice: ' + ids.join(', '));
  if(!shots.length && !hero){
    /* No photography at all: the CSS custom properties must still be `none`,
       or the build embedded bytes nothing can display. */
    const root = W.getComputedStyle(D.getElementById('sdeck'));
    ['--hero-img', '--sec-img-1', '--sec-img-2', '--sec-img-3', '--sec-img-4']
      .forEach(v => aassert(root.getPropertyValue(v).trim() === 'none',
        `${v} carries an embedded image that nothing renders`));
  }
});

wtest('the wordmark reveals per letter and still reads as one word', () => {
  const mark = D.querySelector('#sdeck .bigmark');
  aassert(mark, 'no wordmark');
  /* Split into letters for the mask reveal, so the accessible name has to
     be restored explicitly or assistive tech reads "B E N C H". */
  aassert(mark.getAttribute('aria-label') === G('BRAND'),
    'wordmark has no aria-label; split letters would be read one by one');

  const letters = [...mark.querySelectorAll(':scope > .ltr')];
  const expectLetters = G('BRAND').length + 1;
  aassert(letters.length === expectLetters, `${letters.length} letters, expected ${expectLetters} (${G('BRAND')}.)`);
  letters.forEach((l, i) => {
    aassert(l.getAttribute('aria-hidden') === 'true', `letter ${i} is not hidden from AT`);
    aassert(l.style.getPropertyValue('--i') === String(i), `letter ${i} has no stagger index`);
    /* The mask IS the mechanism: without overflow:hidden the letter just
       sits visible below the line and nothing is revealed. */
    aassert(W.getComputedStyle(l).overflow === 'hidden', `letter ${i} is not a mask`);
    const inner = l.firstElementChild;
    /* Two animations run on each letter now (rise, then the foil sweep),
       so animationName is a list -- match membership, not equality. */
    const names = inner ? W.getComputedStyle(inner).animationName.split(',').map(x => x.trim()) : [];
    aassert(names.includes('markRise'), `letter ${i} has no rise animation`);
  });

  /* Stagger inside the 30-80ms band the animation guidance specifies. */
  const d = i => parseFloat(W.getComputedStyle(letters[i].firstElementChild).animationDelay);
  const step = d(1) - d(0);
  aassert(step >= 0.03 && step <= 0.08, `stagger is ${(step*1000).toFixed(0)}ms, want 30-80ms`);

  /* The lines beneath must wait for the last letter, or they arrive together
     and the sequencing the design asks for is lost. */
  const lastEnds = d(5) + parseFloat(W.getComputedStyle(letters[5].firstElementChild).animationDuration);
  ['.vstate', '.vlede'].forEach(sel => {
    const el = D.querySelector('#sdeck ' + sel);
    if(!el) return;
    aassert(parseFloat(el.dataset.delay) / 1000 >= lastEnds - 0.05,
      `${sel} starts at ${el.dataset.delay}ms, before the wordmark finishes at ${(lastEnds*1000).toFixed(0)}ms`);
  });

  aassert(mark.getBoundingClientRect().width <= mark.parentElement.clientWidth + 1,
    'the wordmark overflows its container');
});

wtest('the foil sweep never leaves the wordmark invisible', () => {
  /* background-clip:text needs a transparent text-fill. If the clip is not
     supported, or the sweep is disabled without restoring the fill, the
     headline renders as nothing -- the blank-page failure mode again.
     So: either the fill is transparent AND a gradient is painting the
     glyphs, or the fill is a real colour. Never transparent with no
     gradient behind it. */
  const inner = D.querySelector('#sdeck .bigmark .ltr > span');
  aassert(inner, 'no wordmark letters');
  const cs = W.getComputedStyle(inner);
  const fill = cs.webkitTextFillColor || cs.color;
  const transparent = /rgba\(0, 0, 0, 0\)|transparent/.test(fill);
  if(transparent){
    aassert(cs.backgroundImage && cs.backgroundImage !== 'none',
      'text-fill is transparent with no gradient behind it: the wordmark would be invisible');
    aassert(W.CSS.supports('background-clip', 'text') ||
            W.CSS.supports('-webkit-background-clip', 'text'),
      'transparent fill without background-clip support');
  }

  /* The sweep must land after the letters, or it plays against a wordmark
     that is still arriving. */
  const names = cs.animationName.split(',').map(s => s.trim());
  if(names.includes('foilSweep')){
    const i = names.indexOf('foilSweep');
    const delay = parseFloat(cs.animationDelay.split(',')[i]);
    aassert(delay >= 1.1, `foil sweep starts at ${delay}s, before the letters land`);
  }
});

wtest('the how-it-works walkthrough is built and self-describing', () => {
  const steps = [...D.querySelectorAll('#sdeck .vs-how .step')];
  aassert(steps.length === 3, `${steps.length} steps, expected 3`);
  steps.forEach((s, i) => {
    aassert(s.querySelector('.step-txt h3'), `step ${i + 1} has no heading`);
    const shot = s.querySelector('.uishot');
    aassert(shot, `step ${i + 1} has no UI replica`);
    /* The replicas are role="img"; without a label a screen reader gets
       nothing at all from them. */
    aassert(shot.getAttribute('role') === 'img', `step ${i + 1} replica is not role=img`);
    aassert((shot.getAttribute('aria-label') || '').length > 30,
      `step ${i + 1} replica has no usable aria-label`);
  });
});

wtest('the footer wordmark fits without clipping a character', () => {
  /* The reference design sets `leading-[0.8]` with tight negative tracking,
     which crops the cap height and eats the final glyph's right side
     bearing -- the period vanishes. Assert the text is not wider than its
     own box and not wider than the footer that holds it. */
  const wm = D.querySelector('#sdeck .vwm');
  aassert(wm, 'no footer wordmark');
  aassert(wm.textContent.trim() === G('BRAND') + '.', 'wordmark reads ' + JSON.stringify(wm.textContent.trim()));
  aassert(wm.scrollWidth <= wm.clientWidth + 1,
    `wordmark overflows its box: scrollWidth ${wm.scrollWidth} > clientWidth ${wm.clientWidth}`);
  const foot = wm.closest('.vfoot');
  aassert(wm.getBoundingClientRect().width <= foot.clientWidth,
    'wordmark is wider than the footer');
  /* Line box must be tall enough for the glyphs, or the caps get cropped. */
  const cs = W.getComputedStyle(wm);
  const fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight);
  aassert(lh >= fs * 0.95, `line-height ${lh} crops a ${fs}px face`);
});

wtest('the home page ends with an aligned track chooser', () => {
  const cards = [...D.querySelectorAll('#bentoGrid [data-bento-card]')];
  aassert(cards.length === G('TRACKS').length, `${cards.length} cards for ${G('TRACKS').length} tracks`);
  /* Equal alignment is the point: same width, same height, same row. */
  const rects = cards.map(c => c.getBoundingClientRect());
  const w = Math.round(rects[0].width), h = Math.round(rects[0].height);
  rects.forEach((r, i) => {
    aassert(Math.abs(Math.round(r.width) - w) <= 1, `card ${i} width ${Math.round(r.width)} != ${w}`);
    aassert(Math.abs(Math.round(r.height) - h) <= 1, `card ${i} height ${Math.round(r.height)} != ${h}`);
  });
  /* Each card carries its own resolved glow colour, not a shared default. */
  const glows = cards.map(c => c.dataset.glow);
  aassert(new Set(glows).size === glows.length, 'tracks share a glow colour: ' + glows.join(' | '));
  glows.forEach(g => aassert(/^\d+, \d+, \d+$/.test(g), 'glow is not an rgb triplet: ' + g));
});

atest('after entering the app, header and deck are actually visible', () => {
  aassert(visible(D.querySelector('header')), 'header not visible after entering the app');
  aassert(visible(D.querySelector('.brandmark')), 'brand mark not visible');
  const deck = D.getElementById('deck');
  aassert(visible(deck), 'deck is not visible -- this is the blank-page bug');
  aassert(deck.textContent.trim().length > 200, 'deck has almost no text: ' + deck.textContent.length);
});

atest('no element renders the literal string "undefined"', () => {
  /* This is how the missing datasetNote entry surfaced: a lookup miss
     stringified into the page instead of throwing. */
  aassert(textHits(/\bundefined\b/).length === 0,
    'found "undefined" in: ' + textHits(/\bundefined\b/).join(' | '));
});

atest('no view renders "undefined" -- every track, every level', () => {
  /* Sweeping every view is what would have caught the missing datasetNote
     entry directly: it only appeared on git lessons, and the home view
     that the check above happens to run on was clean. */
  const bad = [];
  G('TRACKS').forEach(t => [0, 1, 2].forEach(l => {
    W.goto(t.id, l);
    textHits(/\bundefined\b/).forEach(h => bad.push(`${t.id}-${l}: ${h}`));
  }));
  ['practice', 'progress'].forEach(v => {
    G(`state.view = '${v}'`); W.render();
    textHits(/\bundefined\b/).forEach(h => bad.push(`${v}: ${h}`));
  });
  aassert(bad.length === 0, bad.join(' | '));
});

atest('no element renders "NaN" or "[object Object]"', () => {
  const re = /(\bNaN\b|\[object Object\])/;
  aassert(textHits(re).length === 0, 'found in: ' + textHits(re).join(' | '));
});

atest('every enabled track has a sidebar row with a sized, painted swatch', () => {
  const nTracks = G('TRACKS').length;
  const rows = D.querySelectorAll('.trk');
  aassert(rows.length === nTracks, `${rows.length} sidebar rows for ${nTracks} tracks`);
  D.querySelectorAll('.trk-btn .swatch').forEach((sw, i) => {
    const cs = W.getComputedStyle(sw);
    aassert(parseFloat(cs.width) > 0 && parseFloat(cs.height) > 0,
      `swatch ${i} has zero size -- this is the bug where .swatch had no sizing rule`);
    aassert(cs.backgroundImage !== 'none', `swatch ${i} has no gradient`);
  });
});

atest('each track swatch is a DIFFERENT colour', () => {
  const seen = D.querySelectorAll('.trk-btn .swatch');
  const grads = [...seen].map(sw => W.getComputedStyle(sw).backgroundImage);
  aassert(new Set(grads).size === grads.length,
    'two tracks share a swatch colour, so --tg is not varying per row');
});

atest('the energise layer computes: primary button has a gradient and a glow', () => {
  /* Deliberately the git track: the SQL Run button is [disabled] until
     sqlite finishes loading, and disabled buttons drop the glow on
     purpose, which would make this assertion flap. */
  W.goto('git', 0);
  const btn = [...D.querySelectorAll('.btn.pri')].find(b => !b.disabled);
  aassert(btn, 'no enabled primary button found');
  const cs = W.getComputedStyle(btn);
  aassert(cs.backgroundImage.includes('gradient'), 'no gradient on .btn.pri: ' + cs.backgroundImage);
  aassert(cs.boxShadow !== 'none', 'no glow on .btn.pri');
});

atest('switching track recolours the interface', () => {
  W.goto('sql', 0);
  const sqlTk = W.getComputedStyle(D.documentElement).getPropertyValue('--tk').trim();
  W.goto('git', 0);
  const gitTk = W.getComputedStyle(D.documentElement).getPropertyValue('--tk').trim();
  aassert(sqlTk && gitTk && sqlTk !== gitTk,
    `--tk did not change between tracks (${sqlTk} vs ${gitTk})`);
  aassert(D.documentElement.dataset.track === 'git', 'data-track not updated');
});

atest('the git workspace builds and draws a visible commit graph', () => {
  W.goto('git', 1);
  const ta = D.getElementById('userin');
  aassert(ta, 'git workspace has no editor');
  ta.value = 'git checkout -b feature\ngit commit -m "f"\ngit checkout main\ngit commit -m "m"\ngit merge feature';
  D.getElementById('runbtn').click();
  const svg = D.querySelector('svg.gitgraph');
  aassert(visible(svg), 'the commit graph SVG is not visible');
  aassert(D.querySelectorAll('.gg-node').length === 4, 'expected 4 commit nodes');
  aassert(D.querySelectorAll('.gg-node.is-merge').length === 1, 'merge commit not marked');
  const dot = D.querySelector('.gg-dot');
  aassert(W.getComputedStyle(dot).fill.includes('url'), 'commit dots are not gradient-filled');
});

atest('the git graph labels branches', () => {
  const labels = [...D.querySelectorAll('.gg-ref text')].map(t => t.textContent).sort();
  aassert(labels.join(',') === 'feature,main', 'branch pills wrong: ' + labels.join(','));
});

atest('checking a correct git answer marks it solved', () => {
  W.goto('git', 0);
  const ex = G("EX['git-0'][0]");
  D.getElementById('userin').value = ex.solution;
  D.getElementById('checkbtn').click();
  aassert(G('exDone("git",0,0)'), 'a correct answer was not accepted');
});

atest('checking a WRONG git answer is rejected', () => {
  G('state.done = {}'); W.save();
  W.goto('git', 0);
  D.getElementById('userin').value = 'git commit -m "not what was asked"';
  D.getElementById('checkbtn').click();
  aassert(!G('exDone("git",0,0)'), 'an incorrect answer was accepted -- grading is not working');
});

atest('track icons are one consistent family', () => {
  /* The set drifted once already: stroke widths of 1.5, 1.7, 1.8 and 3,
     and R drawn as a letterform while the rest were diagrams. Stroke
     treatment is set on the <g> and inherited, so assert it there. */
  const glyphs = [...D.querySelectorAll('svg defs g[id^="gy-"]')];
  aassert(glyphs.length >= G('TRACKS').length, `only ${glyphs.length} glyphs defined`);

  const widths = new Set();
  glyphs.forEach(g => {
    widths.add(g.getAttribute('stroke-width'));
    aassert(g.getAttribute('stroke') === 'currentColor',
      `${g.id} does not inherit colour via currentColor`);
    aassert(g.getAttribute('stroke-linecap') === 'round' &&
            g.getAttribute('stroke-linejoin') === 'round',
      `${g.id} has different cap/join treatment`);
    /* No child may override the family's stroke width. */
    [...g.children].forEach(child => {
      aassert(!child.hasAttribute('stroke-width'),
        `${g.id} has a child overriding stroke-width`);
    });
  });
  aassert(widths.size === 1, 'mixed stroke widths across icons: ' + [...widths].join(', '));
});

atest('the lesson eyebrow renders the right glyph, at a real size', () => {
  /* The sidebar shows a colour swatch, not an icon -- the glyphs appear in
     the lesson eyebrow, the practice list, the progress grid and the home
     cards. The eyebrow is the one present on every lesson. */
  G('TRACKS').forEach(t => {
    W.goto(t.id, 0);
    const use = D.querySelector('.eyebrow .gy use');
    aassert(use, 'no glyph in the eyebrow for track ' + t.id);
    aassert(use.getAttribute('href') === '#gy-' + t.id,
      `${t.id} eyebrow points at ${use.getAttribute('href')}`);
    const r = use.closest('svg').getBoundingClientRect();
    aassert(r.width > 6 && r.height > 6,
      `${t.id} glyph renders at ${Math.round(r.width)}x${Math.round(r.height)}`);
  });
});

atest('hint and solution are quieter than the primary action', () => {
  /* They are escape hatches, not the main path. Sized like the primary
     button they told the learner to reach for them first. */
  W.goto('git', 0);
  const hint = D.getElementById('hintbtn');
  const sol  = D.getElementById('solbtn');
  const done = D.getElementById('donebtn');
  aassert(hint && sol && done, 'exercise action buttons missing');

  const hh = parseFloat(W.getComputedStyle(hint).height);
  const dh = parseFloat(W.getComputedStyle(done).height);
  aassert(hh <= 30, `hint button is ${hh}px tall; should be small`);
  aassert(hh < dh, `hint (${hh}px) should not be as tall as the primary action (${dh}px)`);

  /* Outlined, not filled -- a filled button reads as "press me". */
  const hb = W.getComputedStyle(hint).backgroundColor;
  aassert(hb === 'rgba(0, 0, 0, 0)' || hb === 'transparent',
    'hint button should not be filled, got ' + hb);
  aassert(parseFloat(W.getComputedStyle(sol).fontSize) <= 13,
    'solution button text is too large');
});

atest('every interface count is derived, and they agree with each other', () => {
  /* n*9 was the old assertion here, in a test named "every count is
     derived" -- it hardcoded the very number it claimed to check, and so
     passed while EX_TOTAL() was itself hardcoded. The counts are now
     checked against the bank in the test below; what this one asserts is
     that they agree with each other and with the rendered interface. */
  const n = G('TRACKS').length;
  aassert(G('LESSON_TOTAL()') === n * 3,
    `LESSON_TOTAL ${G('LESSON_TOTAL()')} for ${n} tracks at 3 levels`);
  aassert(G('EX_TOTAL()') >= G('LESSON_TOTAL()'),
    'fewer exercises than lessons — some lesson has none');
  /* the exact figure is asserted against the bank in its own test below */
  aassert(G('AUTO_CHECKED()') <= G('EX_TOTAL()'), 'more auto-checked exercises than exercises exist');
});

/* Asserts completeness and agreement, not a magic number. The old
   version required exactly three exercises per lesson, so growing the
   bank failed the suite while the genuinely wrong thing -- the totals
   still reporting the old figures -- passed. */
atest('every enabled track has a lesson and exercises at every level', () => {
  const missing = G(`TRACKS.flatMap(t => [0,1,2].flatMap(l => {
    const k = t.id + '-' + l, out = [];
    if(!LESSONS[k]) out.push('lesson ' + k);
    if(!EX[k] || !EX[k].length) out.push('exercises ' + k);
    return out;
  }))`);
  aassert(missing.length === 0, 'missing: ' + missing.join(', '));
});

atest('the totals are counted from the bank, not assumed', () => {
  const real = G(`TRACKS.reduce((n,t) => n + [0,1,2]
                    .reduce((m,l) => m + (EX[t.id+'-'+l]||[]).length, 0), 0)`);
  aassert(G('EX_TOTAL()') === real,
    `EX_TOTAL() says ${G('EX_TOTAL()')} but the bank holds ${real}`);
  const realAuto = G(`TRACKS.filter(t=>t.auto).reduce((n,t) => n + [0,1,2]
                    .reduce((m,l) => m + (EX[t.id+'-'+l]||[]).length, 0), 0)`);
  aassert(G('AUTO_CHECKED()') === realAuto,
    `AUTO_CHECKED() says ${G('AUTO_CHECKED()')} but ${realAuto} sit in auto-checked tracks`);
});

atest('progress view renders its grid and stats visibly', () => {
  G("state.view = 'progress'"); W.render();
  const deck = D.getElementById('deck');
  aassert(visible(deck), 'progress deck not visible');
  const n = G('TRACKS').length;
  const cells = D.querySelectorAll('.pc');
  aassert(cells.length === n * 3, `${cells.length} grid cells for ${n} tracks`);
  D.querySelectorAll('.stat b').forEach(b =>
    aassert(visible(b), 'a stat numeral is not visible'));
});

atest('dark theme keeps text readable against its background', () => {
  D.documentElement.dataset.theme = 'dark';
  const cs = W.getComputedStyle(D.body);
  const lum = c => {
    const [r,g,b] = c.match(/\d+/g).map(Number).map(v => {
      v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  const a = lum(cs.color), b = lum(cs.backgroundColor);
  const ratio = (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
  aassert(ratio >= 4.5, `body text contrast is only ${ratio.toFixed(2)}:1`);
});

atest('light theme keeps text readable against its background', () => {
  D.documentElement.dataset.theme = 'light';
  const cs = W.getComputedStyle(D.body);
  const lum = c => {
    const [r,g,b] = c.match(/\d+/g).map(Number).map(v => {
      v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  const a = lum(cs.color), b = lum(cs.backgroundColor);
  const ratio = (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
  aassert(ratio >= 4.5, `body text contrast is only ${ratio.toFixed(2)}:1`);
});

const runOne = ({name, fn}) => {
  try { fn(); return {name, ok:true}; }
  catch(e){ return {name, ok:false, err:e.message}; }
};

/* Async: welcome assertions, then enter the app, then the rest. */
async function runAppTests(win, settleMs){
  W = win; D = win.document;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const results = AT.filter(t => t.phase === 'welcome').map(runOne);

  /* Enter the app the way a person does. Calling teardownWelcome()
     directly is NOT equivalent: it removes the welcome deck but leaves
     state.view === 'home', so render() keeps body.locked and
     `body.locked main{visibility:hidden}` hides #deck. That in-between
     state never occurs in real use, and asserting against it reports a
     working app as blank. */
  const start = D.querySelector('header [data-go]') || D.querySelector('[data-go]');
  if(start) start.click(); else W.goto('sql', 0);
  await wait(settleMs || 700);          /* let the entrance animation finish */

  results.push(...AT.filter(t => t.phase === 'app').map(runOne));
  return {total:results.length, passed:results.filter(r=>r.ok).length, failed:results.filter(r=>!r.ok)};
}
