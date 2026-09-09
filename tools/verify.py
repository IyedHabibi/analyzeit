"""Run every stored solution and check it is actually correct.

This is the safety net the project was missing. HANDOFF.md records that
all solutions were "machine-verified" -- that was done once, by hand,
with no script left behind. One Python exercise still shipped expecting
2192.5 when the real answer was 3190.0, which told anyone who solved it
correctly that they were wrong. That is the worst failure mode a
teaching tool has: it breaks trust in the one thing the product sells.

What this checks, per track:

  sql     runs the solution against a real SQLite database built from
          DB_SQL, and asserts it executes and returns at least one row.
  python  runs PY_SETUP[data] + solution in a subprocess with real
          pandas and compares stdout against `expect`, using the SAME
          normalisation the app uses (trim, then rstrip each line).
  git     covered by tests/content.html, which asserts each solution
          produces the shape its task claims. Not repeated here.
  r       no runtime anywhere, by design. Reported, never checked.

  python tools/verify.py            check everything
  python tools/verify.py sql        check one track

Exit code is 1 if anything fails, so it can gate a build.
"""
import io, os, re, sys, sqlite3, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def read(rel):
    return io.open(os.path.join(ROOT, rel), encoding='utf-8').read()

# ---------------------------------------------------------------------
# Minimal readers for the JS data files. Deliberately not a JS parser:
# these read one known shape and fail loudly if the shape changes, which
# is better than a general parser that silently half-works.
# ---------------------------------------------------------------------
ESCAPES = {'n': '\n', 't': '\t', 'r': '\r', '\\': '\\', '"': '"', "'": "'",
           '`': '`', '/': '/', '0': '\0', 'b': '\b', 'f': '\f'}

def read_js_string(src, i):
    """Read the JS string literal starting at src[i]; return (value, next_i)."""
    quote = src[i]
    assert quote in '"\'`', f'expected a quote at {i}, found {src[i]!r}'
    out, i = [], i + 1
    while i < len(src):
        c = src[i]
        if c == '\\':
            nxt = src[i + 1]
            if nxt == 'u':
                out.append(chr(int(src[i + 2:i + 6], 16))); i += 6; continue
            out.append(ESCAPES.get(nxt, nxt)); i += 2; continue
        if c == quote:
            return ''.join(out), i + 1
        out.append(c); i += 1
    raise ValueError('unterminated string')

def field(block, name):
    """Every `name:<string>` in a block, in order."""
    vals, i = [], 0
    pat = re.compile(r'(?<![A-Za-z_$])' + name + r'\s*:\s*')
    while True:
        m = pat.search(block, i)
        if not m:
            return vals
        j = m.end()
        if block[j] not in '"\'`':          # a number or identifier, not a string
            k = j
            while k < len(block) and block[k] not in ',}\n':
                k += 1
            vals.append(block[j:k].strip()); i = k; continue
        v, i = read_js_string(block, j)
        vals.append(v)

def lesson_blocks(src):
    """{'sql-0': '<the array body>', ...} for every lesson key."""
    out = {}
    for m in re.finditer(r"^'([a-z]+-\d)'\s*:\s*\[", src, re.M):
        key, start = m.group(1), m.end()
        depth, i = 1, start
        while i < len(src) and depth:
            if src[i] in '"\'`':
                _, i = read_js_string(src, i); continue
            if src[i] == '[': depth += 1
            elif src[i] == ']': depth -= 1
            i += 1
        out[key] = src[start:i - 1]
    return out

def objects(block):
    """Split an array body into its top-level `{...}` object sources."""
    out, depth, start, i = [], 0, None, 0
    while i < len(block):
        c = block[i]
        if c in '"\'`':
            _, i = read_js_string(block, i); continue
        if c == '{':
            if depth == 0: start = i
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0: out.append(block[start:i + 1])
        i += 1
    return out

# ---------------------------------------------------------------------
# Both files, or the totals lie: git's exercises live in git-lessons.js
# and are Object.assign'd onto EX at load. Reading only exercises.js
# reported "27 total" for an app that ships 36 -- the same class of
# stale-count bug this project keeps having.
EX_SRC = read('src/exercises.js') + '\n' + read('src/git-lessons.js')
DATA_SRC = read('src/keep-data.js')

m = re.search(r'const DB_SQL = `(.*?)`;', DATA_SRC, re.S)
assert m, 'DB_SQL not found -- has keep-data.js changed shape?'
DB_SQL = m.group(1)

m = re.search(r'const PY_SETUP = \{(.*?)\n\};', EX_SRC, re.S)
assert m, 'PY_SETUP not found'
PY_SETUP = {}
# Anchored to line starts: the frame definitions are single-line strings
# containing `'rep': [...]` and friends, so an unanchored key pattern
# matches inside the pandas source and reads garbage.
for mm in re.finditer(r"^\s*'([\w-]+)'\s*:\s*(?=['\"`])", m.group(1), re.M):
    v, _ = read_js_string(m.group(1), mm.end())
    PY_SETUP[mm.group(1)] = v

BLOCKS = lesson_blocks(EX_SRC)
ENABLED = re.search(r"const ENABLED = \[(.*?)\]", DATA_SRC).group(1)
ENABLED = re.findall(r"'([a-z]+)'", ENABLED)

def norm(s):
    """The app's own normalisation, so this agrees with what users see."""
    return '\n'.join(l.rstrip() for l in str(s).strip().split('\n'))

# ---------------------------------------------------------------------
def check_sql(key, ex, idx):
    sol = ex.get('solution')
    if not sol:
        return False, 'no solution recorded'
    db = sqlite3.connect(':memory:')
    try:
        db.executescript(DB_SQL)
    except sqlite3.Error as e:
        return False, f'schema failed to build: {e}'
    try:
        cur = db.execute(sol)
        rows = cur.fetchall()
    except sqlite3.Error as e:
        return False, f'solution does not run: {e}'
    finally:
        db.close()
    if not rows:
        return False, 'solution runs but returns zero rows'
    return True, f'{len(rows)} row{"" if len(rows)==1 else "s"}'

def check_python(key, ex, idx):
    sol, want, data = ex.get('solution'), ex.get('expect'), ex.get('data')
    if not sol:
        return False, 'no solution recorded'
    if data not in PY_SETUP:
        return False, f'unknown data frame {data!r}'
    script = PY_SETUP[data] + '\n' + sol
    with tempfile.NamedTemporaryFile('w', suffix='.py', delete=False,
                                     encoding='utf-8') as f:
        f.write(script); path = f.name
    try:
        p = subprocess.run([sys.executable, path], capture_output=True,
                           text=True, timeout=60)
    finally:
        os.unlink(path)
    if p.returncode != 0:
        return False, 'solution raised: ' + p.stderr.strip().split('\n')[-1]
    got = norm(p.stdout)
    if want is None:
        return False, f'no expected output recorded (got {got!r})'
    if got != norm(want):
        return False, f'expected {norm(want)!r} but the solution prints {got!r}'
    return True, repr(got) if len(got) < 30 else 'output matches'

CHECKERS = {'sql': check_sql, 'python': check_python}

def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    total = passed = failed = skipped = 0
    problems = []

    for key in sorted(BLOCKS):
        track = key.split('-')[0]
        if track not in ENABLED:
            continue
        if only and track != only:
            continue
        for idx, src in enumerate(objects(BLOCKS[key])):
            ex = {}
            for name in ('solution', 'expect', 'data'):
                vals = field(src, name)
                if vals:
                    ex[name] = vals[0]
            total += 1
            checker = CHECKERS.get(track)
            if checker is None:
                skipped += 1
                why = ('covered by tests/content.html, which asserts each '
                       'solution produces the shape its task claims'
                       if track == 'git' else
                       'no runtime anywhere, written answer by design')
                print(f'  skip  {key}[{idx}]  ({track}: {why})')
                continue
            ok, note = checker(key, ex, idx)
            if ok:
                passed += 1
                print(f'  ok    {key}[{idx}]  {note}')
            else:
                failed += 1
                problems.append((key, idx, note))
                print(f'  FAIL  {key}[{idx}]  {note}')

    print()
    print(f'{passed} verified, {failed} failed, {skipped} unverifiable '
          f'(no runtime), {total} total')
    if problems:
        print('\nFailures:')
        for key, idx, note in problems:
            print(f'  {key}[{idx}]  {note}')
    return 1 if failed else 0

if __name__ == '__main__':
    raise SystemExit(main())
