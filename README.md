# Bench

A single-file, zero-install web app that teaches the tools data jobs ask for.
See `HANDOFF.md` for the full picture — what it is, why it is built this way,
and the decisions worth not re-litigating.

## Layout

```
src/          source modules (classic scripts, order matters)
tools/        build.py, split.py
tests/        three suites, run in a browser
dist/         the built single file — this is what you ship
dev.html      generated; same page with modules loaded separately
```

## Build

No npm, no node, no bundler. Python 3 only.

```bash
python tools/build.py
```

Writes `dist/bench-data-skills.html` and regenerates `dev.html`.

To prove a change did not alter the output:

```bash
python tools/build.py --check path/to/reference.html
```

## Develop

Open `dev.html` — it loads each module as its own file, so devtools stack traces
name real files instead of one 2,900-line blob. It works from `file://`.

Some things (Pyodide, the WASM fetch for sql.js) prefer a real origin:

```bash
python tools/serve.py
```

**Use `tools/serve.py`, not `python -m http.server`.** The stdlib server sends
`Last-Modified` and no `Cache-Control`, so Chrome serves a stale copy after a
rebuild and the page looks unchanged. That is indistinguishable from "my edit
did nothing" and cost real debugging time. `serve.py` strips the validators and
sends `no-store`.

## Test

Serve the folder, then open `tests/index.html`. It runs all three suites and
prints a single number.

| Suite | Runs against |
|---|---|
| `tests/run.html` | the git engine in isolation |
| `tests/content.html` | the lesson and exercise data |
| `tests/app.html` | the fully rendered app, in an iframe, asserting computed styles |

The app suite asserts on `getComputedStyle`, not just structure. An earlier build
of this project shipped a blank page while every structural test passed; the
elements existed and answered to clicks, they were merely invisible.

## Adding a track

1. Add an entry to `ALL_TRACKS` in `src/keep-data.js`, including `auto:` and
   `runtime:`. Every count and honesty note in the interface derives from those.
2. Add its id to `ENABLED`.
3. Add `<track>-0/1/2` to `LESSONS` and `EX`, and a `PREVIEW` entry.
4. Add a `datasetNote()` entry and a glyph to the inline sprite in `head2.html`.
5. If it has a runtime, add a `ws<Track>()` and dispatch to it in
   `buildWorkspace()`.
6. Add the new files to `ORDER` in `tools/build.py`, respecting load order.
