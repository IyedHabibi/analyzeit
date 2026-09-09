/* Content tests for the git track.
   Running a solution against itself proves nothing -- it always matches.
   These assert that each solution produces the shape its TASK claims,
   which is the failure mode that shipped in the python track (an
   exercise whose expected value was wrong would fail correct answers). */

const CT = [];
const ctest = (name, fn) => CT.push({name, fn});
function cassert(cond, msg){ if(!cond) throw new Error(msg); }

function shapeOf(script){
  const r = seedRepo(['initial commit']);
  const res = runGitScript(r, script);
  const commits = Object.values(r.commits);
  return {
    r, res,
    ok: !res.failed,
    commits: commits.length,
    merges: commits.filter(c => c.parents.length > 1).length,
    branches: Object.keys(r.refs).sort(),
    head: r.head.type === 'branch' ? r.head.name : '(detached)',
    messages: commits.map(c => c.msg),
    tipMsg: r.commits[headCommit(r)]?.msg
  };
}

/* Every solution must at minimum run cleanly. */
ctest('every git solution runs without error', () => {
  const bad = [];
  Object.keys(EX).filter(k => k.startsWith('git-')).forEach(k => {
    EX[k].forEach((ex, i) => {
      const s = shapeOf(ex.solution);
      if(!s.ok) bad.push(`${k}[${i}]: ${s.res.log.at(-1).out}`);
    });
  });
  cassert(bad.length === 0, 'solutions failed to run:\n' + bad.join('\n'));
});

/* And the lesson-level solutions, which are a separate copy. */
ctest('every git lesson solution runs without error', () => {
  const bad = [];
  ['git-0','git-1','git-2'].forEach(k => {
    const s = shapeOf(LESSONS[k].solution);
    if(!s.ok) bad.push(`${k}: ${s.res.log.at(-1).out}`);
  });
  cassert(bad.length === 0, bad.join('\n'));
});

/* Claim-by-claim checks, keyed to what each task actually asks for. */

ctest('git-0[0] creates the analysis branch, switches to it, one commit', () => {
  const s = shapeOf(EX['git-0'][0].solution);
  cassert(s.branches.includes('analysis'), 'no analysis branch');
  cassert(s.head === 'analysis', 'should end checked out on analysis, got ' + s.head);
  cassert(s.tipMsg === 'first pass', 'tip should be "first pass", got ' + s.tipMsg);
  cassert(s.commits === 2, 'expected initial + one commit, got ' + s.commits);
});

ctest('git-0[1] makes two commits in the stated order on main', () => {
  const s = shapeOf(EX['git-0'][1].solution);
  cassert(s.head === 'main', 'should stay on main');
  cassert(s.branches.length === 1, 'no branch should be created');
  cassert(s.tipMsg === 'clean data', 'tip should be "clean data", got ' + s.tipMsg);
  const parent = s.r.commits[s.r.commits[s.r.refs.main].parents[0]];
  cassert(parent.msg === 'load data', 'load data must be the parent of clean data');
});

ctest('git-0[2] leaves experiment behind while main moves on', () => {
  const s = shapeOf(EX['git-0'][2].solution);
  cassert(s.head === 'main', 'must stay on main -- the task says so');
  cassert(s.branches.includes('experiment'), 'no experiment branch');
  cassert(s.r.refs.experiment !== s.r.refs.main, 'experiment must NOT have moved with main');
  cassert(ancestors(s.r, s.r.refs.experiment).size === 1, 'experiment should still be at the initial commit');
});

ctest('git-1[0] produces a real merge commit with two parents', () => {
  const s = shapeOf(EX['git-1'][0].solution);
  cassert(s.merges === 1, 'expected exactly one merge commit, got ' + s.merges);
  cassert(s.head === 'main', 'merge should land on main');
  const tip = s.r.commits[s.r.refs.main];
  cassert(tip.parents.length === 2, 'merge commit must have two parents');
});

ctest('git-1[1] fast-forwards and creates NO merge commit', () => {
  const s = shapeOf(EX['git-1'][1].solution);
  cassert(s.merges === 0, 'task says no merge commit, but got ' + s.merges);
  cassert(s.r.refs.main === s.r.refs.quickfix, 'main should have slid forward to quickfix');
  cassert(s.commits === 2, 'fast-forward creates no commit; expected 2, got ' + s.commits);
});

ctest('git-1[2] forces a merge commit with --no-ff', () => {
  const s = shapeOf(EX['git-1'][2].solution);
  cassert(s.merges === 1, '--no-ff must produce a merge commit, got ' + s.merges);
  cassert(s.head === 'main');
});

ctest('git-1[1] and git-1[2] must grade differently', () => {
  /* They describe the same branch work; only the merge style differs.
     If the signatures matched, one exercise would accept the other's
     answer and the --no-ff lesson would be untestable. */
  const a = seedRepo(['initial commit']); runGitScript(a, EX['git-1'][1].solution);
  const b = seedRepo(['initial commit']); runGitScript(b, EX['git-1'][2].solution);
  cassert(repoSignature(a) !== repoSignature(b),
    'fast-forward and --no-ff must produce distinguishable histories');
});

ctest('git-2[0] rebases to a linear history', () => {
  const s = shapeOf(EX['git-2'][0].solution);
  cassert(s.merges === 0, 'a rebase must not leave a merge commit, got ' + s.merges);
  cassert(s.head === 'feature', 'should end on feature');
  /* feature must now contain the main-side commit in its ancestry */
  const anc = [...ancestors(s.r, s.r.refs.feature)].map(id => s.r.commits[id].msg);
  cassert(anc.includes('unrelated'), 'rebased feature should sit on top of "unrelated"');
  cassert(anc.includes('step one'), 'rebased feature should still contain its own commit');
});

ctest('git-2[0] copies rather than moves -- originals remain', () => {
  const s = shapeOf(EX['git-2'][0].solution);
  /* initial, step one, unrelated, step one' = 4. If this is 3 the engine
     moved commits instead of replaying them, and the lesson's central
     claim ("rebase copies") would be false in the simulator. */
  cassert(s.commits === 4, 'expected 4 commit objects after replay, got ' + s.commits);
});

ctest('git-2[1] undoes by ADDING a commit, not removing one', () => {
  const s = shapeOf(EX['git-2'][1].solution);
  cassert(s.commits === 3, 'revert should add a third commit, got ' + s.commits);
  cassert(/^Revert /.test(s.tipMsg), 'tip should be a Revert commit, got ' + s.tipMsg);
  const anc = [...ancestors(s.r, s.r.refs.main)].map(id => s.r.commits[id].msg);
  cassert(anc.includes('leaked key'), 'revert must KEEP the original commit in history');
});

ctest('git-2[2] resets so the tip is the earlier commit', () => {
  const s = shapeOf(EX['git-2'][2].solution);
  cassert(s.tipMsg === 'work in progress', 'tip should be "work in progress", got ' + s.tipMsg);
  cassert(ancestors(s.r, s.r.refs.main).size === 2, 'main should reach back over 2 commits only');
});

ctest('git-2[1] and git-2[2] demonstrate opposite strategies', () => {
  const rev = shapeOf(EX['git-2'][1].solution);
  const res = shapeOf(EX['git-2'][2].solution);
  cassert(ancestors(rev.r, rev.r.refs.main).size > ancestors(res.r, res.r.refs.main).size,
    'revert should grow history while reset shrinks the reachable set');
});

/* PREVIEW wiring: every exercise names a data key, and the lesson view
   looks it up. A missing key renders an empty panel with no error. */
ctest('every git exercise points at a PREVIEW that exists', () => {
  const missing = [];
  Object.keys(EX).filter(k => k.startsWith('git-')).forEach(k =>
    EX[k].forEach((ex, i) => { if(!PREVIEW[ex.data]) missing.push(`${k}[${i}] -> ${ex.data}`); }));
  cassert(missing.length === 0, 'missing PREVIEW entries: ' + missing.join(', '));
});

ctest('the git track is registered and enabled', () => {
  cassert(ENABLED.includes('git'), 'git not in ENABLED');
  cassert(ALL_TRACKS.some(t => t.id === 'git'), 'git not in ALL_TRACKS');
  cassert(TRACKS.some(t => t.id === 'git'), 'git not in the derived TRACKS list');
  ['git-0','git-1','git-2'].forEach(k => {
    cassert(LESSONS[k], 'missing lesson ' + k);
    cassert(EX[k] && EX[k].length === 3, 'expected 3 exercises for ' + k);
  });
});

function runContentTests(){
  const results = CT.map(({name, fn}) => {
    try { fn(); return {name, ok:true}; }
    catch(e){ return {name, ok:false, err:e.message}; }
  });
  return {total:results.length, passed:results.filter(r=>r.ok).length, failed:results.filter(r=>!r.ok)};
}
