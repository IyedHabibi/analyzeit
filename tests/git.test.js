/* Tests for the git engine.
   Runs in the browser (no node on this machine) via tests/run.html.
   Assertions are on repo SHAPE, which is what the exercises grade on. */

const T = [];
const test = (name, fn) => T.push({name, fn});
function assert(cond, msg){ if(!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg){ if(a !== b) throw new Error((msg || 'not equal') + `\n  got:  ${a}\n  want: ${b}`); }

/* Run a script against a fresh seeded repo. */
function R(script, seed){
  const r = seedRepo(seed || ['initial commit']);
  const res = runGitScript(r, script);
  return {r, res};
}

/* ---------- basics ---------- */

test('commit advances the branch and chains to its parent', () => {
  const {r} = R(`git commit -m "a"\ngit commit -m "b"`);
  eq(ancestors(r, r.refs.main).size, 3, 'expected initial + a + b');
  const tip = r.commits[r.refs.main];
  eq(tip.msg, 'b');
  eq(r.commits[tip.parents[0]].msg, 'a');
});

test('checkout -b creates a branch at HEAD and switches to it', () => {
  const {r} = R(`git checkout -b feature`);
  eq(r.head.name, 'feature');
  eq(r.refs.feature, r.refs.main, 'new branch should start at the same commit');
});

test('branch does not move when a different branch commits', () => {
  const {r} = R(`git checkout -b feature\ngit commit -m "f1"`);
  assert(r.refs.feature !== r.refs.main, 'feature must have moved past main');
  eq(ancestors(r, r.refs.main).size, 1);
  eq(ancestors(r, r.refs.feature).size, 2);
});

/* ---------- merging ---------- */

test('merge fast-forwards when the branch has not diverged', () => {
  const {r, res} = R(`git checkout -b feature
git commit -m "f1"
git checkout main
git merge feature`);
  assert(res.log.at(-1).out.includes('Fast-forward'), 'expected a fast-forward');
  eq(r.refs.main, r.refs.feature, 'main should now point at the same commit');
  /* A fast-forward creates no commit. */
  eq(Object.keys(r.commits).length, 2);
});

test('merge of diverged branches creates a commit with two parents', () => {
  const {r} = R(`git checkout -b feature
git commit -m "f1"
git checkout main
git commit -m "m1"
git merge feature`);
  const tip = r.commits[r.refs.main];
  eq(tip.parents.length, 2, 'a real merge has two parents');
  assert(tip.msg.startsWith('Merge branch'), 'expected a merge commit message');
  /* first parent = the branch merged into, second = the branch merged in */
  eq(r.commits[tip.parents[0]].msg, 'm1');
  eq(r.commits[tip.parents[1]].msg, 'f1');
});

test('merge --no-ff forces a merge commit even when it could fast-forward', () => {
  const {r} = R(`git checkout -b feature
git commit -m "f1"
git checkout main
git merge --no-ff feature`);
  eq(r.commits[r.refs.main].parents.length, 2);
});

test('merging an already-merged branch is a no-op', () => {
  const {res} = R(`git checkout -b feature\ngit checkout main\ngit merge feature`);
  eq(res.log.at(-1).out, 'Already up to date.');
});

/* ---------- merge base ---------- */

test('mergeBase finds the divergence point', () => {
  const r = seedRepo(['initial commit']);
  runGitScript(r, `git commit -m "shared"`);
  const base = r.refs.main;
  runGitScript(r, `git checkout -b feature
git commit -m "f1"
git checkout main
git commit -m "m1"`);
  eq(mergeBase(r, r.refs.main, r.refs.feature), base);
});

/* ---------- rebase ---------- */

test('rebase replays commits and leaves a linear history', () => {
  const {r} = R(`git checkout -b feature
git commit -m "f1"
git commit -m "f2"
git checkout main
git commit -m "m1"
git checkout feature
git rebase main`);
  /* feature should now be: initial <- m1 <- f1' <- f2', all single-parent */
  let id = r.refs.feature, chain = [];
  while(id){ chain.push(r.commits[id].msg); eq(r.commits[id].parents.length <= 1, true, 'rebase must not create merges'); id = r.commits[id].parents[0]; }
  eq(chain.join(' <- '), 'f2 <- f1 <- m1 <- initial commit');
});

test('rebase creates NEW commits -- the originals still exist', () => {
  const {r} = R(`git checkout -b feature
git commit -m "f1"
git checkout main
git commit -m "m1"
git checkout feature
git rebase main`);
  /* initial, f1, m1, f1' = 4. The old f1 is orphaned but not deleted;
     this is the point of the "rebase rewrites history" lesson. */
  eq(Object.keys(r.commits).length, 4);
});

/* ---------- undo ---------- */

test('reset moves the branch pointer back', () => {
  const {r} = R(`git commit -m "a"\ngit commit -m "b"\ngit reset --hard HEAD~1`);
  eq(r.commits[r.refs.main].msg, 'a');
});

test('revert adds a new commit rather than removing one', () => {
  const {r} = R(`git commit -m "oops"\ngit revert HEAD`);
  eq(ancestors(r, r.refs.main).size, 3, 'revert should ADD a commit');
  assert(r.commits[r.refs.main].msg.startsWith('Revert '), 'expected a Revert commit');
});

test('cherry-pick copies one commit onto the current branch', () => {
  const {r} = R(`git checkout -b feature
git commit -m "wanted"
git checkout main
git cherry-pick feature`);
  eq(r.commits[r.refs.main].msg, 'wanted');
  eq(ancestors(r, r.refs.main).size, 2, 'only the one commit should come across');
});

/* ---------- revision parsing ---------- */

test('HEAD~n walks first parents', () => {
  const {r} = R(`git commit -m "a"\ngit commit -m "b"\ngit commit -m "c"`);
  eq(r.commits[resolveRev(r, 'HEAD')].msg, 'c');
  eq(r.commits[resolveRev(r, 'HEAD~1')].msg, 'b');
  eq(r.commits[resolveRev(r, 'HEAD~2')].msg, 'a');
});

test('caret selects a merge parent', () => {
  const {r} = R(`git checkout -b feature
git commit -m "f1"
git checkout main
git commit -m "m1"
git merge feature`);
  eq(r.commits[resolveRev(r, 'HEAD^1')].msg, 'm1');
  eq(r.commits[resolveRev(r, 'HEAD^2')].msg, 'f1');
});

test('a short hash resolves to its commit', () => {
  const {r} = R(`git commit -m "findme"`);
  const full = r.refs.main;
  eq(resolveRev(r, full.slice(0, 5)), full);
});

/* ---------- structural comparison: the thing grading depends on ---------- */

test('the same history built by different routes compares equal', () => {
  const a = R(`git checkout -b feature
git commit -m "f1"
git checkout main
git commit -m "m1"
git merge feature`).r;
  /* Same shape, but the branch is created later and named along the way. */
  const b = seedRepo(['initial commit']);
  runGitScript(b, `git branch feature
git commit -m "m1"
git checkout feature
git commit -m "f1"
git checkout main
git merge feature`);
  eq(repoSignature(a), repoSignature(b), 'identical shapes must compare equal');
});

test('a different commit message makes histories differ', () => {
  const a = R(`git commit -m "a"`).r;
  const b = R(`git commit -m "b"`).r;
  assert(repoSignature(a) !== repoSignature(b), 'different messages must not compare equal');
});

test('merge vs rebase produce different shapes', () => {
  const merged = R(`git checkout -b feature
git commit -m "f1"
git checkout main
git commit -m "m1"
git merge feature`).r;
  const rebased = R(`git checkout -b feature
git commit -m "f1"
git checkout main
git commit -m "m1"
git checkout feature
git rebase main
git checkout main
git merge feature`).r;
  assert(repoSignature(merged) !== repoSignature(rebased),
    'a merge commit and a linear rebase are different histories and must grade differently');
});

test('HEAD position is part of the signature', () => {
  const a = R(`git checkout -b feature`).r;
  const b = R(`git branch feature`).r;   /* same refs, HEAD still on main */
  assert(repoSignature(a) !== repoSignature(b), 'which branch is checked out matters');
});

/* ---------- errors ---------- */

test('commit without -m is an error, not a silent no-op', () => {
  const {res} = R(`git commit`);
  eq(res.failed, true);
  assert(res.log.at(-1).out.includes('message'), 'error should mention the message');
});

test('a script stops at the first failing line', () => {
  const {r, res} = R(`git commit -m "ok"\ngit bogus\ngit commit -m "never runs"`);
  eq(res.failed, true);
  eq(res.log.length, 2, 'should not continue past the failure');
  eq(ancestors(r, r.refs.main).size, 2, 'the third command must not have run');
});

test('deleting the checked-out branch is refused', () => {
  const {res} = R(`git checkout -b feature\ngit branch -d feature`);
  eq(res.failed, true);
});

/* ---------- graph layout ---------- */

test('layout gives children a greater row than their parents', () => {
  const {r} = R(`git checkout -b feature
git commit -m "f1"
git checkout main
git commit -m "m1"
git merge feature`);
  const g = layoutGraph(r);
  const row = Object.fromEntries(g.nodes.map(n => [n.id, n.row]));
  g.edges.forEach(e => assert(row[e.from] > row[e.to],
    'an edge must always point from a lower row to a higher one, or the graph draws backwards'));
});

test('layout marks the merge commit and the HEAD commit', () => {
  const {r} = R(`git checkout -b feature
git commit -m "f1"
git checkout main
git commit -m "m1"
git merge feature`);
  const g = layoutGraph(r);
  eq(g.nodes.filter(n => n.merge).length, 1);
  eq(g.nodes.filter(n => n.isHead).length, 1);
  assert(g.nodes.find(n => n.refs.includes('main')), 'main should be labelled on a node');
});

/* ---------- runner ---------- */
function runTests(){
  const results = T.map(({name, fn}) => {
    try { fn(); return {name, ok:true}; }
    catch(e){ return {name, ok:false, err:e.message}; }
  });
  return {
    total: results.length,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok)
  };
}
