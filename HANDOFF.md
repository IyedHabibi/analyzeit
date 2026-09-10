# Bench — data skills learning platform

Handoff notes. Written to be pasted into Claude Code alongside `bench-data-skills.html`.

---

## What it is

A single-file, zero-install web app that teaches the tools data jobs ask for. The
person reads a job-scenario brief, sees the actual rows they're working on, writes
a query or formula, and gets told immediately whether they're right — because the
answer is compared against a known-correct one, not self-assessed.

Currently ships **4 tracks × 3 levels × 3 exercises = 36 exercises, 12 lessons.**

Open the HTML in a browser. No build step, no server, no npm install.

---

## Current state

| | |
|---|---|
| Source | `src/*.js` + `src/head2.html`, built by `tools/build.py` |
| Built file | `dist/bench-data-skills.html`, ~300 KB, single file |
| Dev entry | `dev.html` — same page, modules loaded separately |
| External deps | `sql.js` 1.8.0 and `Chart.js` 4.4.1, both from cdnjs |
| Degrades if CDN blocked? | Yes — tested. Chrome, sidebar and all lessons still render |
| Storage | `localStorage`, key `bench.progress.v2`. Nothing is uploaded |
| Themes | Light + dark, applied pre-paint in `<head>` to avoid FOUC |
| Fonts | Archivo + Syne + Sora + JetBrains Mono + Newsreader, Google Fonts |

---

## Which tracks ship

One line near the top controls everything downstream — counts, the progress grid,
the sidebar, the intro copy:

```js
const ENABLED = ['sql','python','r','git'];
```

**Read this before changing it.** Four tracks genuinely execute in the browser and
auto-check answers; two do not:

| Track | Runtime | Auto-checked |
|---|---|---|
| SQL | SQLite compiled to WASM (`sql.js`) | Yes — result sets compared row by row |
| Excel | Formula evaluator I wrote (~200 lines) | Yes — value compared to expected |
| Python | Pyodide + pandas, loaded on demand (~15 MB, behind a button) | Yes — stdout compared as text |
| Git | Commit-DAG simulator (`git-engine.js`) | Yes — histories compared by shape |
| R | **None.** No browser R runtime available | No — written answer vs worked solution |
| Power BI | **None.** Not a thing that can run in a browser | No — written answer vs worked solution |

With the current `['sql','python','r','git']`, **27 of 36** exercises auto-check
and all 9 that don't are R. The owner chose to keep R rather than swap it for
Excel; adding Git raised the auto-checked share from 67% to 75% without dropping
it. Swapping R for Excel would still make it 36 of 36, and is still one line.

`auto` is now a property on each `ALL_TRACKS` entry rather than a hardcoded list
elsewhere — the list was the thing that went stale. Every count and every honesty
note in the interface derives from that flag, so a new track cannot silently
claim to be checked when it is not.

---

## Architecture

The shipped file is a concatenation of separate source files joined in a fixed
order. **Order matters**: `views.js` calls `render()` at its end, and everything
it touches must already be defined.

**The split is done.** `tools/build.py` concatenates `src/` back into
`dist/bench-data-skills.html`. The `ORDER` list in that script is load-bearing and
is commented as such.

```
head2.html        markup + all CSS + pre-paint theme script
keep-data.js      DB_SQL schema, SHEET grid, ALL_TRACKS (+ auto flag), ENABLED
keep-lessons.js   15 lesson bodies (scenario, concept, worked example)
exercises.js      45 exercises + PREVIEW tables + PY_SETUP starters
git-lessons.js    3 git lessons + 9 git exercises, Object.assign'd onto the above
keep-engines.js   state, SQL runner, Excel evaluator, Pyodide loader
git-engine.js     commit DAG, porcelain, structural comparison, graph layout
motion.js         Spring class, projection, rubberbanding, Tracker
celebrate.js      success animation
ui.js             sidebar, right rail, lesson view, swipe, sheet
git-ui.js         git workspace + inline-SVG commit graph
bento.js          vanilla port of the MagicBento card effects
welcome.js        the home page (vertical sections, not the old ticker)
views.js          workspaces, practice, progress, routing
```

They are **classic scripts, not ES modules**, deliberately. Module scripts are
fetched, and `file://` fetches are blocked, so ES modules would have cost the
project its zero-install property and forced a server on every reader. Plain
concatenation in order has identical execution semantics: the first build after
the split reproduced the original 184,598-byte file **byte-for-byte**, which is
what proved the split faithful rather than merely plausible.

`python tools/build.py --check <reference>` re-runs that comparison.
`dev.html` loads the modules separately, so devtools stack traces name real files
instead of one 2,893-line blob. It works from `file://` too.

### The pieces worth understanding

**Excel evaluator** (`keep-engines.js`) — recursive-descent parser. Handles
`+ - * / ^ %`, parens, comparisons, string concat, `$`-locked refs, ranges, and
~15 functions (SUM, AVERAGE, COUNTIF, SUMIF, VLOOKUP, MEDIAN, IF…). 32 unit tests
pass. Two bugs were found and fixed here: ranges were collapsing to their first
cell, and `$F$2` didn't parse at all.

**Spring** (`motion.js`) — closed-form damped oscillator, not numerical
integration. This matters: the original semi-implicit Euler version ate ~92% of
the overshoot at a real 60 Hz frame, and behaved differently at 120 Hz. The
analytic solution is exact and frame-rate independent — verified at 30/60/120/240 Hz.
Re-targeting carries velocity, so gestures reverse without a discontinuity.

**Home page** (`welcome.js`) — vertical sections, revealed on scroll. Sections
are sized by macro-whitespace padding, NOT viewport height; a hero fade-out tied
to viewport height erased the hero after 200px of scroll and was removed. This
replaced the horizontal ticker, which had two structural problems: scroll length
was `viewport + row.scrollWidth` over one very long sentence, so finishing it took
a great many wheel turns; and words travelled sideways under a vertical gesture,
so every line was in motion while you tried to read it. Sections are now
viewport-height, the type is large and still, and each section fades and rises
once as it arrives. The page is ~5 screens instead of a long horizontal run.

**Do not reintroduce GSAP ScrollTrigger here.** Still true, and for the original
reason: pinning inside this custom fixed scroller needs `scrollerProxy`, and that
indirection lags the true scroll position.

**The reveal is IntersectionObserver plus a slow poll.** IO is primary. The
poll is NOT redundant:
IO is the tidier API and was the first implementation. It does not work here: an
occluded or backgrounded window starves the rendering lifecycle, and IO,
`requestAnimationFrame` *and* scroll events are all dispatched from it. Verified
on this machine — a fresh `IntersectionObserver` reported zero intersections for
an element sitting at top 201 in a 720px viewport, and the page rendered blank
below the hero with all content present. So: `.rv` does not hide anything by
itself; the hidden state lives under `.scrolldeck.rv-on`, added by script only
once a reveal mechanism is running, and a 400ms poll clears itself as soon as
everything is in. **Content must never depend on an animation to become
visible.**

**Lesson completion is derived, never stored on its own.** A lesson is complete
only when all three of its exercises are. `reconcile()` runs at boot and drops any
lesson marked done without its exercises. This exists because an earlier version
stored lesson keys directly and `doneCount()` counted every key in the store,
conflating lesson and exercise keys — producing "Lessons 1/15, Exercises 0/45".

---

## What's verified, and how

All content is machine-checked, not eyeballed:

- **9 SQL solutions** executed against real SQLite. Teaching claims verified too —
  e.g. that `COUNT(*)` returns 1 and `COUNT(e.id)` returns 0 for the empty
  department, which is what that lesson is about.
- **9 Excel solutions** through the evaluator.
- **9 Python solutions** against real pandas. One was wrong — the cleaning
  exercise expected 2192.5, actual answer is 3190.0. Anyone solving it correctly
  would have been told they were wrong.
- **Spring physics** numerically: overshoot 1.516% at damping 0.8, matching the
  theoretical `exp(-πζ/√(1-ζ²))` exactly, at every frame rate.
- **DOM + computed styles** in jsdom: all lessons render, chrome survives, and
  `visible()` walks ancestors checking `display`/`visibility`/`opacity`.

### Test suites

Serve the folder and open `tests/index.html` — it aggregates all three and prints
one number. **72 tests, all green** at time of writing, against both `dev.html` and the built file.

| Suite | File | Covers |
|---|---|---|
| git engine | `tests/run.html` | 25 tests — commit/branch/merge/rebase/reset/revert/cherry-pick semantics, revision parsing, structural comparison, graph layout |
| git content | `tests/content.html` | 16 tests — every git solution runs, and produces the shape its *task* claims |
| rendered app | `tests/app.html` | 31 tests — computed-style visibility, no "undefined"/"NaN" in the DOM, grading accepts correct answers and rejects wrong ones, derived counts agree, both themes clear 4.5:1 body contrast. Add `?src=../dist/bench-data-skills.html` to run the same suite against the shipped artifact rather than the dev entry |

Three things learned writing these, worth keeping:

- **A content test must assert the task's claim, not re-run the solution.** A
  solution compared against itself always passes and proves nothing. The git
  suite instead asserts that the fast-forward exercise produces *zero* merge
  commits while the `--no-ff` one produces exactly one — and that the two grade
  differently, so neither can accept the other's answer. That is the class of bug
  that shipped in the python track.
- **The app's top-level `const`/`let` are script-scoped, not on `window`.** Only
  `function` declarations land on `window`. A test driving the app from outside
  an iframe must reach `TRACKS`/`EX`/`state` via `frame.contentWindow.eval`.
  Getting this wrong reads as "the app is broken" when it is fine.
- **Enter the app the way a user does.** Calling `teardownWelcome()` directly is
  *not* equivalent to clicking Start: it removes the welcome deck but leaves
  `state.view === 'home'`, so `render()` keeps `body.locked` and
  `body.locked main{visibility:hidden}` hides `#deck`. That in-between state
  never occurs in real use, and asserting against it reports a working app as
  blank — the mirror image of the original bug below.

### MagicBento is a port, not a dependency

The card effects on the home page (spotlight, border glow, particles, 3D tilt,
magnetism, click ripple) come from the MagicBento React component. It was **not**
installed: it needs `react`, `react-dom`, `gsap`, `lucide-react`, `clsx` and
`tailwind-merge`, and this project ships as one HTML file with no build step, no
server and no npm install. Adding a React runtime to render four cards would have
traded that away for nothing visible.

`bento.js` reimplements every effect against what is already here — the Web
Animations API instead of GSAP, CSS custom properties instead of Tailwind — and
keeps the original option names (`enableStars`, `spotlightRadius`, `glowColor`,
…). Two things worth knowing if you touch it:

- **Particles are a wrapper plus a child.** The original runs two GSAP tweens on
  one element, an entrance and an infinite drift, and GSAP reconciles them
  internally. WAAPI does not — the second animation replaces the first. Splitting
  drift (wrapper) from scale (child) avoids it with no compositing mode to rely on.
- **Tilt and magnetism compose into one `transform` string.** They are separate
  GSAP tweens upstream; here they would overwrite each other.

Cards are equal-sized and aligned in one row. An asymmetric bento was tried and
made the tracks look ranked, which they are not.

### Serve with `tools/serve.py`, never `python -m http.server`

The stdlib server sends `Last-Modified` with no `Cache-Control`, so Chrome
serves a cached copy after a rebuild. Symptom: the page looks byte-identical to
the previous build and `document.styleSheets` contains none of the new rules —
which reads as "the CSS change did nothing" rather than "the browser never
fetched it". It also silently invalidates any visual check made in that state.
`tools/serve.py` strips `Last-Modified`/`ETag` and sends `no-store`.

### Testing lesson learned — please keep this

An early build shipped with `body.locked main { visibility: hidden }` while
`#deck` lived *inside* `<main>`. The entire home page rendered blank. **Every
structural test passed** — the elements existed, had the right children, and
responded to clicks. I was testing the DOM and calling it testing the page.

jsdom *does* compute styles via `getComputedStyle`. Assert on them. Structure
tests alone will not catch invisible.

They also won't catch *ugly*. Nothing short of a real browser will.

---

## Direction D -- the exercise page on paper

The home page and the exercise page used to be two different design systems. They are
now one. The owner picked a blend of three studies: **A/C's cards, B's ruled ledger
interior, and a VS Code editor.** Mockups of all four live in a published artifact.

The organising rule, and the reason each choice is what it is:

> **Dark is the machine, paper is the document.**

The header rail and the code editor are where the computer speaks. Every surface you
read, check or are graded on is paper. Nothing is dark for decoration -- which is what
keeps the blend from being three borrowed styles in a stack.

What it changed, all in one bannered `DIRECTION D` block at the end of `head2.html`:

| | |
|---|---|
| Sidebar | dark -> paper (`--paper`, so it follows the theme) |
| Header rail | unchanged, still dark in both themes |
| Lesson body | one white card on canvas, `--rl` radius, `--shade-1` |
| Lesson title | Newsreader, matching the home page's headings |
| Section heads | JetBrains Mono, spaced, uppercase, over a hairline |
| Code editor | dark VS Code panel via `.pane:has(> textarea.code)` |
| Result tables | column heads over a hard rule, rows striped not lined |
| Verdict | stated over a coloured rule, not inside a filled panel |

Three things worth knowing before touching it:

- **`:has()` is doing real work.** `.pane:has(> textarea.code)` means *any* pane holding a
  code textarea is an editor, including the worked example. That is deliberate: a new
  workspace gets the editor treatment automatically and the two cannot drift apart. It
  also means no new class name was needed, so this block cannot become a fourth
  `.sec` / `.bigmark` / `.rv` collision.
- **Do not give `Run` a flat fill.** An earlier version set `.btn.pri` to a pale colour on
  the dark editor, which silently overrode the energise layer's gradient. `tests/app.html`
  caught it -- *"primary button has a gradient and a glow: no gradient on .btn.pri"*. The
  primary action carries the track's identity; on the dark panel it is the one warm thing
  there.
- **The verdict's rule is on the state classes only** (`.pass` / `.fail` / `.hint`), never
  on `.verdict` itself. `.verdict` sits at `height:0` when closed, and a border on the base
  class renders as a stray line above a collapsed element.

This block is deletable wholesale to revert to the previous look.

## Direction D, part 2

Four changes after the first pass, all in a second bannered block.

- **Right-rail cards had no horizontal padding.** `.card` ships
  `padding:16px 0 4px` -- zero left and right -- because it was originally a
  hairline-separated run of text. The energise layer later made
  `.side-r .card` a bordered, rounded, raised panel and never added side
  padding, so every label sat flush against its own border, and the 64px
  accent bar was offset `left:14px` to an edge with no padding to align to.
  Now `15px 16px 16px`, bar re-aligned, and `:first-child` gets its top
  padding back (the base rule zeroes it -- right for a run of text, wrong
  for a panel).
- **The wordmark is larger:** `clamp(72px,14.5vw,216px)`. Newsreader sets
  "BENCH." at about 3.7em, so 216px runs roughly 800px and still sits inside
  the 64rem measure; the 72px floor keeps it inside a 375px viewport.
- **The home page has a dark mode.** Warm paper gets a *warm* dark, not a
  generic one -- canvas `#141311`, not blue-black -- so it reads as the same
  document at night. Measured: `--ink-mute` 6.46:1 and body 12.19:1 on that
  canvas. It engages on its own, because the pre-paint script in `<head>`
  already sets `data-theme` from `prefers-color-scheme` when nothing is
  stored. **There is still no theme toggle on the home page itself** -- the
  app's toggle lives in the header, which the home deck covers. Adding one
  to `.lnav` is the obvious next step.
  - The foil sweep needed its own dark branch. The light band dips *darker*
    than the letter, which on a dark canvas erases it mid-sweep -- the same
    failure the light version was designed around, mirrored. On dark the
    band runs lighter, so the sweep only ever adds contrast.
- **Credit in the home footer** -- name plus LinkedIn and GitHub, styled at
  the size of the fine print around it.

### Four more hardcoded counts, now derived

The same guardrail the older notes describe had drifted again in `ui.js`:
`doneCount()} / 15`, `All 45 solved`, `Why these five`, and `All fifteen
done` -- against an app that ships 12 lessons, 36 exercises and 4 tracks. So
the home rail read "1 / 15". All four now derive from `LESSON_TOTAL()`,
`EX_TOTAL()` and `TRACKS.length`.

**This keeps happening in prose.** The counts in markup were fixed; the ones
written into sentences were missed both times. Worth a test that greps the
rendered DOM for bare integers near the words "lessons", "exercises" and
"solved" -- the failure is always a number spelled out in copy.

## Direction D, part 3

- **Every lesson opened scrolled past its own beginning.** `goto()` ends with
  `main.scrollIntoView({block:'start'})`, which aligns main's top with the top
  of the *viewport* -- but the header is `position:fixed` and 56px tall, so the
  eyebrow and the top of the title sat behind it. Fixed with
  `main{scroll-margin-top:calc(var(--hdr) + 20px)}` rather than a JS offset:
  scrollIntoView honours it, so the single call site is untouched and any
  future anchor into main inherits the clearance. Measured after: main lands
  20px below the header, eyebrow fully visible.
- **A theme toggle on the home page.** The home deck sits at `z-index:90` and
  covers the app header, so the header's toggle was unreachable and dark mode
  there could only be reached by changing the OS setting. The new `.lthm`
  button in `.lnav` **forwards its click to `#theme`** rather than repeating
  the toggle logic -- one implementation of what switching theme means, so the
  two cannot drift.
- **Stat tiles were pressed against their own dividers.** `.stat` and `.fact`
  ship `padding:16px 18px 16px 0` -- 18px right, nothing left -- from a version
  where they were a plain row of figures. Each later gained a `border-right`,
  so every tile after the first began at the previous tile's rule with its
  number touching the line. Measured before: text at 0px from the tile's left
  edge on all four. Now symmetric, except the first tile, which keeps its flush
  edge so the row still aligns with the prose above it; below 860px the tiles
  stack and the padding comes off again.

**This is the third instance of one defect.** Rail cards, then stat tiles, both
the same shape: *padding written for a borderless element, a border added
later, padding never revisited.* Worth checking any remaining element that
gained a border or background after it was first styled -- `.plist` / `.prow`
were checked and are correct.

## The mark — the owner's render, used directly

The interface uses **`assets/logo.jpg` itself**, not a redraw. It appears in exactly two places, by the owner's instruction: the **header**, and the **footer beside the author's links**. Not in the hero -- the wordmark carries that alone. Three problems
had to be solved to get there; all three are worth not rediscovering.

1. **The ground was baked in** — a warm off-white with a vignette, which showed as
   a light box on the dark chrome. Cut out by taking alpha from each pixel's
   distance below *its own row's* ground (a flat threshold clips, because the
   bottom corners sit ~8 levels darker than the top), then **unpremultiplying**
   against that ground. Without the unpremultiply the soft edges keep cream mixed
   in and the mark wears a pale halo the moment it is on anything dark.
2. **It is dark oxblood**, so on the `#0D1015` header it is almost invisible.
   Solved by **two cuts of the same object, chosen by theme** -- the original on
   light grounds, a light rendering of it on dark ones. The light cut is not a hue
   change: each pixel's own luminance is the mix factor between two light tones,
   so the bevels and the grain are the same object under different light. An
   intermediate version put the original on a paper *plate* on dark instead; the
   owner preferred the two-cut split, so the plate is gone.

   The frame is dark in **both** themes, so the header always takes the light cut.
   The footer follows the page theme via `--logo-here`.

3. **Size.** PNG stores a continuous-tone render badly — 119 KB at 256px. WEBP
   with alpha carries the same image at 34 KB, so both variants cost about 91 KB
   of base64 instead of 305 KB. The build went 329 KB → 431 KB.

The frame is dark in **both** themes, so `.hexmark` always takes the light
variant. The home page follows its theme, so `.lmark` and `.heromark` switch via
`--logo-here`.

Favicon is a 64px PNG of the render, not WEBP: browser support for WEBP favicons
is still uneven. Its data URI is written with single-quoted SVG attributes and
percent-encoded with `"` unsafe — an earlier version left raw double quotes in
`href="..."`, which terminated the attribute early and silently killed the icon.

### The vector redraws are kept but unused

`assets/analyzeit-hex.svg` and `analyzeit-hex-small.svg` are a vector
interpretation of the same mark. They are **not** referenced by the app. They
exist because a raster cannot do two things a vector can: stay crisp at arbitrary
size, and recolour by inheritance. If the mark ever needs to sit at 16px, or in a
single ink, reach for those rather than scaling the render down.

The earlier attempt at a *simplified* small cut is instructive: reducing it to a
hexagon and a letter produced a generic mark that could belong to anything. The
six vertex nodes and the chevron stack are what identify this logo — they are the
last things to remove, not the first.

## The mark

The product is **AnalyzeIt**. The name lives in `BRAND` (`keep-data.js`); the tests
read it from there rather than hardcoding a string.

The logo came from the owner as a 3D render (`assets/logo.jpg`, 928x1129). It is
**not** what ships in the interface, for two reasons that are worth not
rediscovering:

- **Its ground is baked in.** A warm off-white with a vignette, so it shows as a
  light box on the dark header and in the dark home theme.
- **It is continuous-tone.** A transparent cut was made (`assets/logo-*.png`,
  alpha from the ground delta, then unpremultiplied so the soft edges do not keep
  cream mixed in and wear a pale halo on dark). It still halos slightly, and the
  oxblood goes dark-on-dark. Also 119 KB at 256px against a 327 KB single-file
  build.

So the interface uses a **vector redraw** of it, in two cuts:

| File | Where | Why |
|---|---|---|
| `assets/analyzeit-hex.svg` | home hero, `.heromark` | the full drawing: hexagon, node network, A, chevron stack |
| `assets/analyzeit-hex-small.svg` | header `.hexmark`, home nav `.lmark`, favicon | hexagon and letter only |

**Two drawings, not one scaled.** Only the interior *network* closes into a blur
below ~40px, so the small cut drops that and keeps the six vertex nodes and the
chevron stack at heavier weights.

**The first attempt cut too much.** It kept the hexagon and the letter only, which
produced a generic hexagon-with-an-A -- indistinguishable from any number of other
marks and, correctly, rejected. The vertex nodes and the chevron stack are what
identify this logo; they are the last things to remove, not the first. The cuts
were compared side by side at 24/28/32/40/64px on the real header colour before
choosing.

**The favicon's data URI must not contain raw double quotes.** The first version
percent-encoded with `"` in the safe set, so the `href="..."` attribute terminated
at the first attribute quote inside the SVG and the favicon silently did not load.
The SVG is written with single-quoted attributes and encoded with `"` unsafe.

Both are `currentColor`, so they invert with the theme and need no second file.
The **favicon is the exception** -- `currentColor` cannot resolve there, so its
colour is stated as `#9F2F2D`, which stays legible on a light or a dark tab.

The raster is kept: `logo.jpg` (original), `logo-card.jpg` (trimmed, 111 KB, keeps
its paper ground and material) for any large light-ground surface where the render
is wanted, and `logo-{128,256,512,1024}.png` as transparent cuts.

## Credit

`Built by Iyed Habibi · LinkedIn · GitHub`, with the mark beside it, appears in
**both** footers:

- the home page footer (`.vcredit`, in `welcome.js`)
- a site footer on every app view (`.sitefoot`, in the shell markup)

The second one exists because the credit originally lived only on the landing
page, so it was invisible to anyone who clicked Start and stayed in the app --
which is most of the session. It sits inside `<main>`, which means it rides every
view (Lessons, Practice, Progress) and is hidden on the home page for free: the
existing `body.locked main{visibility:hidden}` rule already covers it while the
welcome deck is up.

Both link out with `target="_blank"` and `rel="noopener noreferrer"`.

The footer takes its layout from a reference the owner supplied (author left,
links right) and none of its styling: the reference was a black bar with a bright
red name, which would have read as a widget pasted onto the end of the page. It
uses the site's own paper, rule and ink instead.

Its colours resolve through **`var()` fallbacks rather than duplicated rules** --
`var(--canvas, var(--paper))`, `var(--line, var(--rule))`, and so on. The home
page defines `--canvas` / `--line` / `--ink-strong` inside `.scrolldeck`; the app
defines `--paper` / `--rule` / `--ink`. One rule set is therefore correct in both
contexts, and any new surface inherits it for free.

**The GitHub and LinkedIn marks are the real ones.** They label links to the
author's own profiles, which is what both companies' brand guidelines permit them
for. This does not contradict the no-brand-logos guardrail: that rule exists so a
*track glyph* cannot imply a tool vendor endorses the curriculum.

## Two things that were easy to get wrong

**The app header is invisible on the home page.** It sits at `z-index:60`; the
welcome deck is `z-index:90` and covers the viewport. So putting the mark only in
`<header>` puts it nowhere the landing page can show it -- the home page's own
`.lnav` is that page's header, and needs its own copy. This was shipped wrong
once: the mark was in `<header>` and the footer, and the home page had none at
all.

**The wordmark's foil sweep repeats on a 5s cycle.** It is one animation stretched
to 5s with the travel compressed into the first 30% (1.5s, the original speed) and
the remaining 3.5s parked at `-30%`. Both `-30%` and `130%` sit outside the
highlight band, so the wrap back to the start shows no jump: the mark is solid ink
at both ends of the loop. `prefers-reduced-motion` still replaces the whole thing
with a fade, so the loop never runs there.

Verifying it needs care -- `getKeyframes()` does not surface `background-position`
in Chrome, as this file already warns. Sample
`getComputedStyle(el).backgroundPosition` over several seconds instead, and check
a *later* cycle: sampling only the first five seconds cannot tell a loop from a
one-shot.

## The footer hid itself

Two mistakes shipped together and read as "the footer was never added":

- **`body.locked .sitefoot{display:none}`** was meant to hide the *app* footer
  while the welcome deck is up. But the home page renders its own copy of
  `.sitefoot` inside `#sdeck`, and `body` carries `locked` on that page -- so the
  selector matched both and the credit was `display:none` exactly where it was
  supposed to appear. It is `body.locked > .sitefoot` now: the app footer is a
  direct child of `<body>`, the home one is not.
- The home footer was **nested inside `<footer class="vfoot">`**, a footer inside
  a footer. Invalid, and structurally in the wrong place.

Both were invisible to the test suite, which checks the app views rather than the
foot of the landing page. If a third footer ever appears, assert on it.

## The counts were never derived

`HANDOFF.md` has said since the first pass that "every number in the interface is
computed from `ENABLED`". That was not true. The three functions everything else
reads from were:

```js
const EX_TOTAL     = () => TRACKS.length*3*3;
const LESSON_TOTAL = () => TRACKS.length*3;
const AUTO_CHECKED = () => TRACKS.filter(t=>t.auto).length*9;
```

They derive from the **number of tracks**, not from the exercise bank -- a
hardcoded three-per-lesson assumption wearing the costume of a derived value. It
read as correct for as long as the bank happened to hold exactly three per
lesson. Growing the bank to 54 would have left the interface claiming 36
exercises and 27 auto-checked.

They now count the bank. Two tests were complicit and are fixed:

- one required `EX[k].length === 3`, so *adding content failed the suite*;
- one named **"every interface count is derived"** asserted `EX_TOTAL() === n*9`
  -- hardcoding the number it claimed to be checking, which is why it passed
  while the value it guarded was itself hardcoded.

The replacement asserts the totals against a recount of `EX`, so a count and the
bank cannot disagree without failing.

## tools/verify.py

The safety net that was missing. `python tools/verify.py [track]` runs **every**
stored solution:

- **sql** against a real SQLite built from `DB_SQL`; asserts it executes and
  returns at least one row.
- **python** through real pandas in a subprocess, comparing stdout to `expect`
  with the app's own normalisation.
- **git** reported as covered by `tests/content.html`, not re-checked here.
- **r** reported as unverifiable by design.

Exit code 1 on any failure, so it can gate a build. Run it before shipping
content -- the project has already shipped one exercise whose expected value was
wrong, which told correct answers they were wrong.

It reads `exercises.js` **and** `git-lessons.js`. Reading only the first reported
"27 total" for an app shipping 36 -- the same stale-count bug, in the tool built
to catch stale counts.

## The bank

54 exercises: SQL 18, Python 18, Git 9, R 9. 45 auto-checked. All 36 SQL and
Python solutions verified by `tools/verify.py`; the 9 git ones by
`tests/content.html`; the 9 R ones are written answers by design.

## Accounts

Optional sign-in with progress sync, on Supabase. Three properties hold, in
this order of importance, and any change here must keep them:

1. **The app works with no account.** Anonymous is not a degraded mode -- it is
   the original product, unchanged. Verified: an anonymous visitor loads no SDK,
   defines no `window.supabase`, and makes no request. `hasStoredSession()`
   checks localStorage for Supabase's own `sb-<ref>-auth-token` key *before*
   deciding to fetch anything, so the network cost of never signing in is zero.
2. **It works offline and with the CDN blocked.** Every failure path is
   silent-and-local; the sign-in dialog turns a blocked CDN into a sentence
   rather than an error.
3. **Local is the working copy.** Solving writes to localStorage first and
   pushes after. A failed push never costs you the answer you just got right.

**Files:** `supabase/schema.sql` (run once in the SQL editor), `src/sync.js`
(client, merge, push), `src/auth-ui.js` (the dialog, built on first use).

**Security is Row Level Security, not JavaScript.** The publishable key in
`sync.js` is meant to be readable in page source and grants nothing by itself;
Postgres refuses to return or accept a row whose `user_id` is not the caller's.
Four separate policies rather than one `FOR ALL`, because a single permissive
policy is easy to write too loosely and its mistakes are silent. **The
service-role key must never appear in any file that ships** -- it bypasses RLS.

**Sync is diffed, not replayed.** `save()` is the one choke point every progress
change passes through, so it is wrapped: 400ms after a change, the current
solved set is diffed against what the server is believed to hold, and only the
difference is pushed. That catches solving, un-solving and Reset progress
without touching any of their call sites.

**Merge is a union, deliberately.** Signing in on a second device keeps
solved-on-either-side. The cost: un-solving on one device does not erase it on
the other *at merge time* (ongoing changes do propagate, being diffed). Losing a
solve is worse than keeping a stale one.

**Data minimisation is the schema, not a policy sentence.** One table, three
columns: `user_id`, `ex_key`, `solved_at`. No profile, no display name, no
activity log, no analytics table. `ON DELETE CASCADE` from `auth.users` means
erasure is one delete rather than a cleanup script that can miss a table. Every
table added here is a table that must appear in the privacy policy, be covered
by the export, and be deleted on request.

**No analytics, and that is a legal position as much as a taste one.** With only
a strictly-necessary auth session and no marketing or analytics cookies, no
consent banner is required under ePrivacy. Adding Plausible or PostHog changes
that, and also makes the footer copy false again.

### The copy had to change

`"Progress stays in this browser. Nothing is uploaded."` became false the moment
sync existed. Three places said it; all three now say what is actually true.
The worst was on the Progress page: *"Nothing is uploaded, and there is no
account to make."*

### Still to do before launch

- **Dashboard setup** (below) -- the code is inert until this is done.
- **Full account deletion** currently needs a support request: the client can
  delete progress rows but cannot delete the `auth.users` row, which requires
  the service-role key. That belongs in an Edge Function, not in the bundle.
- `PRIVACY.md` and `TERMS.md` are drafts and are **not linked from the site
  yet**. They need a lawyer's read, then a route.

### Supabase dashboard steps

1. **SQL Editor** -> run `supabase/schema.sql`.
2. **Authentication -> Providers** -> enable Google (needs a Google Cloud OAuth
   client id and secret).
3. **Authentication -> URL Configuration** -> set Site URL and add every origin
   the app is served from to Redirect URLs, or OAuth silently fails.
4. **Authentication -> Email** -> confirm "Confirm email" is ON, or sign-ups
   skip verification.

## Sign-in is required, and it is a one-time code

Starting a lesson opens the account dialog. There are **no passwords anywhere**:
`signInWithOtp` creates the account if the address is new and signs in if it is
not, so one flow covers both and there is nothing to leak or forget.

The code **verifies on the sixth digit** -- no submit button. Paste fills all six
boxes at once (without that, a pasted code drops five digits into a
`maxlength=1` field); backspace walks back; a wrong code clears the row and
refocuses; resend runs on a 60s timer because Supabase rate-limits it.

**The gate checks `hasStoredSession()`, not just `sbUser`.** `syncBoot()` is
asynchronous, so a returning user who clicks within the first second is signed
in without `sbUser` being populated yet. Gating on `sbUser` alone shows them a
wall they had already passed.

### It needs custom SMTP to send codes at all

Supabase's built-in email service **cannot have its templates edited**, and its
default message contains a link, not a `{{ .Token }}` code. It is also
rate-limited to a handful of messages an hour and is explicitly not for
production -- a few signups in quick succession and sign-in breaks for everyone.

So: Resend (or any SMTP) -> Supabase **Authentication -> Emails -> SMTP
Settings** -> then the template unlocks and `{{ .Token }}` can go in the body.
The dialog says "if the email contains a link instead of a code, clicking it
signs you in too", so it stays honest in either configuration.

`{{ .Token }}` is the six digits. `{{ .TokenHash }}` is **not** interchangeable
with it -- swap them and users get an unreadable string with no error anywhere.

### The confirmation-link bug worth not repeating

The lazy-load in `syncBoot()` returned early when no session was stored, which
is right for an anonymous visitor and **wrong for someone arriving from a
confirmation email**: they have no stored session yet but do have credentials in
the URL. The SDK never loaded, the tokens were never read, and they landed
logged out -- having already spent their single-use token. `hasAuthCallback()`
is the exception that was missing. Tokens are also scrubbed from the address bar
afterwards, so they do not sit in history or in any copied link.

## Interface changes

- **The wordmark has no full stop** and is the way back to the home page; the
  `Home` tab is gone. The click handler is delegated from `<header>`, not
  `#nav` -- the brandmark lives outside `#nav`, so binding there left it inert.
- **A solved exercise looks solved**: the editor gets a green edge and a Solved
  badge. The old button said "Mark not done" once solved, which reads exactly
  like an exercise that was never finished. On auto-checked tracks it is gone
  entirely -- you earn it from the checker. **R keeps its Mark solved button**,
  because with no runtime, self-marking is the only mechanism there is.
- **The hero has a call to action.** It did not before: `ctaTrack` was computed
  and never used, and the `.vcta` / `.btn-hero` styles had no markup to attach
  to. The only way in was the small nav Start, which is why the page read flat.
- **Phone spacing.** The hero carried 9rem/7rem padding written for desktop --
  a third of an 812px screen spent on air before the first word.
- **Display name**, stored in the auth user's metadata rather than a profiles
  table: a second table would need its own RLS, its own privacy-policy row, its
  own export line and its own delete path, for one string.
- **Export and delete are fine print**, not buttons. They are GDPR Articles 15,
  20 and 17 -- obligations, not features. Almost nobody clicks them; removing
  them would not remove the obligation, only make it manual.

**Do not put a backtick in a comment inside a JS template literal.** An HTML
comment reading `` `ctaTrack` `` inside `host.innerHTML = \`...\`` closed the
string and the entire app failed to boot.

## The bank: 84 exercises

SQL 24, Python 24, Git 18, R 18. 66 auto-checked.

- SQL and Python: `python tools/verify.py`, against real SQLite and real pandas.
- Git: `tests/content.html`, which runs each solution and asserts it produces
  the shape its **task** claims.
- R: written answers, by design.

**Prefer Series and scalar outputs to DataFrame reprs** in Python exercises. Two
drafted exercises printed DataFrames, whose column alignment can shift between
pandas versions -- and Pyodide's pandas is not the one `verify.py` runs. A
version bump would silently start failing correct answers.

**The three-per-lesson assumption has now been removed three times**: from
`EX_TOTAL()`/`AUTO_CHECKED()`, from `tests/app.test.js`, and from
`tests/content.test.js`. Each time, growing the bank failed the suite while
nothing was actually wrong. If a fourth appears, it is the same bug.

## Known issues and next steps

**Fixed in a later pass**
- **Mobile was broken, and silently.** `.vs` is `display:grid`, so `.vin` is a
  grid item and grid items default to `min-width:auto` -- they cannot shrink
  below min-content. Min-content here is set by `<pre class="us-code">`, whose
  `white-space:pre` makes its longest SQL line unbreakable. At 375px that forced
  `.vin` to 445px and pushed **46 elements past the viewport edge**; because
  `.scrolldeck` is `overflow:hidden` they were *clipped, not scrollable*, so the
  content was unreachable on a phone. Fixed with `min-width:0` on the grid items
  and `overflow-x:auto` on the code blocks. Measured after: every element past
  the edge has a genuine scrollable ancestor, zero orphans.
- **The app header overflowed at 375px.** It needed 521px; flex resolved that by
  crushing both 32x32 icon buttons to 15px and pushing the theme toggle to
  x=511 -- off-screen and unreachable. `.count` was already hidden at 860, but
  the nav had never been touched at any width. Fixed at `max-width:560px`:
  `flex:none` on the icon buttons, wordmark drops to its glyph, tightened
  metrics. All four nav items now fit at 375px exactly; below that the nav
  scrolls rather than overflowing.
- The celebration seal sprang from `scale(0)`. Nothing appears from nothing --
  it starts at `0.62` now. The bounce stays; that one is earned.
- `.sec { padding:110px 26px }`, the old intro's section wrapper, collided
  with `.btn.sec`, the secondary-button modifier. Same bare class name, and the
  section rule came later, so it won: every "Check answer" button rendered
  145x220px with 110px of vertical padding. **This shipped in the original
  file** and was simply never scrolled to. The section class was dead markup, so
  the rules were deleted rather than renamed; the competing `.rv` reveal system
  in the same block went with them.
- The six track glyphs were not a family: stroke widths of 1.5, 1.7, 1.8 and 3,
  and R drawn as a letterform while every other mark was a diagram. Rewritten as
  one system -- shared 24x24 box, shared optical inset, stroke treatment set once
  on the `<g>` and inherited. R is now a distribution curve. A test asserts the
  uniformity.
- Home copy rewritten to lead with the actual moment the product is for
  ("Can you pull these numbers before the 2pm?") rather than a general welcome.

**Fixed in the first pass**
- Split into modules with a build script, verified byte-identical.
- `Tracks started 0 / 5` was a hardcoded `/ 5` with an ENABLED-derived numerator,
  so it could never read above 3/5. Now `/ ${TRACKS.length}`.
- `.swatch` had **no sizing rule anywhere** — only four `display:none` overrides
  — so in the sidebar, the one place it is visible, it rendered 0×0 and no track
  colour dot ever appeared. It now has a size and carries its track's gradient.
- `datasetNote()` had no `git` key and, unlike its neighbours, no fallback, so it
  rendered the literal string "undefined" into the right rail. Entry added, plus
  `|| ''` so the next track cannot reintroduce it.
- `AUTO_CHECKED()` hardcoded `['sql','python','excel']`; the home-page facts
  hardcoded `27` and `15`; the copy hardcoded "five tools", "SQL, Excel and
  Python", "R and Power BI". All now derive from the `auto` flag, restoring the
  guardrail that every number is computed from `ENABLED`.

**Do next**
1. Decide the `ENABLED` question above (Excel vs R) — still one line.
2. Get eyes on it at **mobile widths**. It has now been seen in a real browser at
   1440×900 and asserted on via computed styles, but the narrow breakpoints at
   860px and 1120px have still never been rendered.

**Worth doing**
4. Move R server-side so its 9 exercises can auto-check. This is the single
   biggest quality gap.
5. Expand the exercise bank. Three per lesson is thin; the structure supports any
   number (`EX[lessonKey]` is an array).
6. Real Kaggle data. Currently the tables are embedded samples modelled on known
   Kaggle sets, because Kaggle needs auth and blocks browser requests. Server-side
   ingestion would fix this.
7. Accounts and cross-device progress. Currently `localStorage` only.

**Library swaps if it becomes a real project** (nothing can be installed in a
single file, so these were all hand-rolled):

| Hand-rolled now | Should be |
|---|---|
| `Spring` class | `motion` |
| Counting-up stats via `textContent` | `NumberFlow` — animating a number by re-rendering text is the known anti-pattern |
| Chart.js | `recharts` |
| Exercise tabs, disclosure panels | `base-ui` — currently hand-rolled `aria-current`, no focus management |
| Theme toggle | `next-themes` |

Not needed: virtualization (results cap at 60 rows), drag-and-drop, a state
library at this size.

---

## Design system

**Superseded for the sidebar** -- see *Direction D* below. The rule now is **dark is
the machine, paper is the document**: the header rail and the code editor stay dark in
both themes, and every surface you read, check or are graded on is paper. The original
reasoning, kept because the tradeoff it names is real: dark chrome (header *and*
sidebar) in both themes with a bright work surface is how tools people sit in for hours
are built, and it gives hierarchy at a glance. Moving the sidebar to paper spends some
of that glance-level hierarchy to buy continuity with the home page.

- **Type** — Archivo (UI), Syne (display), Sora (small caps/labels), JetBrains
  Mono (all data, code, numbers). Tracking is size-specific, never one value.
- **Colour** — each track owns a hue and drives `--tk` via a `data-track`
  attribute on `<html>`, so the whole interface recolours as you move between
  tracks. **The home page no longer shares this palette** -- see the design
  section below.
- **The energise layer** — appended at the end of the stylesheet under a banner
  comment, and purely decorative: colour, gradient, glow, depth. It moves nothing
  and resizes nothing, so it cannot break a layout the rules above already get
  right, and it can be deleted wholesale to revert the look. Each track owns a
  two-stop ramp (`--tk` → `--tk-2`) exposed as `--tk-grad` / `--tk-glow`. The ramp
  fills shapes and paints glows; **it never sits behind body text**, so the
  already-checked contrast of the flat `--tk` still holds. `prefers-contrast:
  more` puts the flat fill back on gradient-filled numerals, since
  `background-clip:text` is lower contrast than a solid fill by construction.
- **Motion** — press feedback on `pointerdown` not click; springs, not fixed-
  duration transitions, for anything interruptible; custom cubic-beziers, never
  browser defaults; hover states gated behind `@media (hover:hover) and
  (pointer:fine)`.
- **Accessibility** — `prefers-reduced-motion` gets the finished page, never a
  blank one waiting for an animation. Also handles `prefers-contrast: more` and
  `prefers-reduced-transparency`.

---

## Home page design — current state

The home page went through several directions before landing here. What ships:

**Premium Utilitarian Minimalism**, a warm monochrome document aesthetic. Canvas
`#F7F6F3`, surfaces `#FFFFFF`, every rule `1px solid #EAEAEA`. Ink `#111111`,
body `#2F3437`, secondary `#6E6C68`. Colour is scarce: four muted pastels
(`#FDEBEC/#9F2F2D` red, `#E1F3FE/#1F6C9F` blue, `#EDF3EC/#346538` green,
`#FBF3DB/#956400` yellow), and the four track hues remap onto them inside
`.scrolldeck`.

Type: **Newsreader** for headings and quotes only, **Archivo** for body and UI,
**JetBrains Mono** for code and data. No Playfair -- an oversized display serif
was the specific thing that read as generated output.

The wordmark is a per-letter **mask reveal** (each letter is an
`overflow:hidden` window; the inner span rises through it), followed by a
**foil sweep** -- an animated `background-position` on a `background-clip:text`
gradient.

Three things about that sweep, all measured:

- **It is foil, not chrome, for a hard reason.** A chrome highlight peaks at
  1.08:1 against this canvas -- the letter vanishes mid-sweep. The band peaks
  at `#85806F` (3.66:1, above the 3:1 floor for large text).
- **`background-clip:text` needs a transparent text-fill**, so an unsupported
  clip renders an *invisible headline*. It is gated behind `@supports`, and the
  reduced-motion branch restores a solid fill explicitly. A test asserts the
  fill is never transparent without a gradient behind it.
- **`getKeyframes()` does not surface `background-position`** in current Chrome.
  It reports `{offset:0}, {offset:1}` and nothing else, which looks exactly like
  a stylesheet that failed to parse. It is not. Verify by slowing the animation
  and reading `getComputedStyle().backgroundPosition` instead. This cost three
  rounds of chasing a bug that did not exist.

`#787774`, the secondary grey the design brief specified, measures **4.14:1** on
this canvas and fails the 4.5:1 floor. It is `#6E6C68` here. Accessibility beat
the palette; a test enforces it.

### The CSS is layered, and that is debt

`head2.html` carries **eight** banner-commented layers, each from a successive
redesign, resolved by source order. Two were removed rather than stacked on
(PRINT and APPLE, replaced by PROTOCOL), but the rest remain. A consolidation
pass is worth doing before the next visual change.

**Class-name collisions have bitten three times.** Each was the same shape: a
class defined for a removed design still matching live markup.

| Collision | Symptom |
|---|---|
| `.sec` (section) vs `.btn.sec` (secondary button) | every "Check answer" button rendered 145x220px |
| `.bigmark` (old ticker) vs `.bigmark` (new title) | title silently centred; `white-space:nowrap` + `overflow:hidden` would have clipped it |
| `.rv` (old intro reveal) vs `.rv` (new reveal) | two systems, working only by specificity accident |

Before adding a class, grep for it. `.fineprint`, `.footstrip`, `.navhint` and
`.dhint` are known-dead and still present.

### Testing traps found the hard way

- **`:focus-visible` does not match programmatic `.focus()`.** Test it that way
  and you measure the UA default ring and conclude the focus ring is invisible.
  Check `matches(':focus-visible')` first, or drive a real Tab press.
- **The browser pane can report `innerWidth: 0`.** Every layout measurement then
  reads as collapsed. Check the viewport before believing a layout bug.
- **An occluded window starves IO, rAF, scroll events, CSS transitions and CSS
  animations alike.** Content that looks blank or faded may simply not be being
  rendered. Timers keep running; that is why the reveal poll exists.

---

## Guardrails

- **No brand logos.** Excel, Power BI, Python, R and Git marks are trademarks.
  All track glyphs are original SVG in an inline sprite (`#gy-sql` etc). The git
  glyph is a generic commit-dot-branching-into-two, not the Git logo.
- **No invented claims.** No press quotes, no student counts, no testimonials.
  Every number in the interface is computed from `ENABLED`.
- **State the limits.** The intro says outright which tracks execute and which are
  written answers. Don't remove that; it is why the thing is trustworthy.
