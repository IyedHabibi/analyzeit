/* ============================================================
   GIT WORKSPACE — editor, transcript, and the live commit graph.

   The graph is the point of this track. Branching and rebasing are
   spatial ideas taught almost everywhere as prose, and prose is why
   they take people months. Here the DAG redraws on every command,
   so "rebase copies commits" stops being a claim and becomes a
   thing you watch happen.

   Drawn as inline SVG from layoutGraph(). No charting library:
   the shape is a handful of circles and paths, and Chart.js has no
   opinion about DAGs.
   ============================================================ */

const GIT_LANE = 30;    /* px between branch columns */
const GIT_ROW  = 44;    /* px between commits */
const GIT_PADX = 26;
const GIT_PADY = 24;

function gitGraphSVG(repo){
  const g = layoutGraph(repo);
  if(!g.nodes.length){
    return '<div class="outmsg">No commits yet. Run <code>git commit -m "message"</code>.</div>';
  }

  const W = GIT_PADX * 2 + Math.max(1, g.lanes) * GIT_LANE + 210;
  const H = GIT_PADY * 2 + Math.max(1, g.rows) * GIT_ROW;
  const x = n => GIT_PADX + n.lane * GIT_LANE;
  const y = n => GIT_PADY + n.row * GIT_ROW;
  const pos = Object.fromEntries(g.nodes.map(n => [n.id, n]));

  let s = `<svg class="gitgraph" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
      role="img" aria-label="Commit graph: ${g.nodes.length} commits across ${g.lanes} branch lane${g.lanes===1?'':'s'}">
    <defs>
      <linearGradient id="gg-node" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="var(--tk)"/><stop offset="100%" stop-color="var(--tk-2)"/>
      </linearGradient>
    </defs>`;

  /* Edges first so nodes sit on top of them. */
  g.edges.forEach(e => {
    const a = pos[e.from], b = pos[e.to];
    if(!a || !b) return;
    const x1 = x(a), y1 = y(a), x2 = x(b), y2 = y(b);
    const d = x1 === x2
      ? `M${x1} ${y1} L${x2} ${y2}`
      /* Cubic with vertical control points: the line leaves the child
         going straight up before bending, which is how git GUIs draw
         lane changes and why they stay readable when lanes are close. */
      : `M${x1} ${y1} C ${x1} ${y1 - GIT_ROW * 0.55}, ${x2} ${y2 + GIT_ROW * 0.55}, ${x2} ${y2}`;
    s += `<path class="gg-edge" d="${d}"/>`;
  });

  g.nodes.forEach((n, i) => {
    const cx = x(n), cy = y(n);
    s += `<g class="gg-node${n.isHead ? ' is-head' : ''}${n.merge ? ' is-merge' : ''}" style="--i:${i}">`;
    if(n.isHead) s += `<circle class="gg-halo" cx="${cx}" cy="${cy}" r="12"/>`;
    s += `<circle class="gg-dot" cx="${cx}" cy="${cy}" r="${n.merge ? 7 : 5.5}"/>`;
    if(n.merge) s += `<circle class="gg-inner" cx="${cx}" cy="${cy}" r="2.4"/>`;

    const labelX = GIT_PADX + Math.max(1, g.lanes) * GIT_LANE + 4;
    s += `<text class="gg-msg" x="${labelX}" y="${cy + 4}">${esc(n.msg)}</text>`;

    /* Ref pills sit to the right of the message, in source order so
       the branch you are on reads first. */
    let rx = labelX + Math.min(n.msg.length * 6.4 + 12, 150);
    n.refs.forEach(ref => {
      const isTag = ref.startsWith('tag:');
      const text = isTag ? ref.slice(4) : ref;
      const w = text.length * 6.1 + 14;
      s += `<g class="gg-ref${isTag ? ' is-tag' : ''}${n.isHead && !isTag ? ' is-current' : ''}">
        <rect x="${rx}" y="${cy - 9}" width="${w}" height="18" rx="9"/>
        <text x="${rx + w/2}" y="${cy + 4}">${esc(text)}</text></g>`;
      rx += w + 5;
    });
    s += `</g>`;
  });

  return s + '</svg>';
}

/* Render the transcript of a run: each command with its output, and
   the failing line marked so the eye lands on it. */
function gitTranscript(res){
  if(!res.log.length) return '<div class="outmsg">Nothing ran.</div>';
  return '<div class="gitlog">' + res.log.map(l =>
    `<div class="gl${l.ok ? '' : ' bad'}"><div class="gl-cmd">$ ${esc(l.cmd)}</div>` +
    (l.out ? `<div class="gl-out">${esc(l.out)}</div>` : '') + '</div>').join('') + '</div>';
}

function wsGit(w, L){
  w.innerHTML = `<div class="pane">
    <div class="pane-bar">terminal<span class="sp"></span><span id="gitstate">one command per line</span></div>
    <textarea class="code" id="userin" rows="6" spellcheck="false"
      placeholder='git checkout -b feature&#10;git commit -m "message"'></textarea>
    <div class="acts">
      <button class="btn pri pressable" id="runbtn">Run</button>
      <button class="btn sec pressable" id="checkbtn">Check answer</button>
      <span style="flex:1"></span>
      <button class="btn qui pressable" id="cheatbtn">Commands</button>
    </div>
    <div class="out" id="out"><div class="outmsg">Run some commands to build a history.</div></div>
  </div>
  <div class="pane gitviz">
    <div class="pane-bar">commit graph<span class="sp"></span><span id="gitcount"></span></div>
    <div class="gg-wrap" id="graph"></div>
  </div>`;

  const out   = document.getElementById('out');
  const graph = document.getElementById('graph');
  const count = document.getElementById('gitcount');

  const draw = repo => {
    graph.innerHTML = gitGraphSVG(repo);
    const n = Object.keys(repo.commits).length;
    const b = Object.keys(repo.refs).length;
    count.textContent = `${n} commit${n===1?'':'s'}, ${b} branch${b===1?'':'es'}`;
  };

  /* Always start from the same one-commit repo, so a learner can run
     the same script twice and get the same answer. Statefulness here
     would make every exercise depend on invisible history. */
  const fresh = () => seedRepo(['initial commit']);
  draw(fresh());

  const go = check => {
    const text = document.getElementById('userin').value.trim();
    if(!text){ verdict('fail','Write at least one command first.'); return; }

    const repo = fresh();
    const res  = runGitScript(repo, text);
    out.innerHTML = gitTranscript(res);
    draw(repo);

    if(!check) return;
    if(res.failed){
      verdict('fail','<b>A command failed.</b> ' + esc(res.log.at(-1).out) + ' Nothing after that line ran.');
      return;
    }

    const want = fresh();
    const sol  = runGitScript(want, L.solution);
    if(sol.failed){ verdict('fail','The stored solution failed to run — please report this.'); return; }

    if(repoSignature(repo) === repoSignature(want)){
      const n = Object.keys(repo.commits).length;
      const merges = Object.values(repo.commits).filter(c => c.parents.length > 1).length;
      onSolved(`${n} commits, ${Object.keys(repo.refs).length} branches` +
               (merges ? `, ${merges} merge commit${merges===1?'':'s'}` : ', linear history') + '.');
    }else{
      verdict('fail','<b>Not matching yet.</b> ' + diffRepos(repo, want));
    }
  };

  document.getElementById('runbtn').onclick   = () => go(false);
  document.getElementById('checkbtn').onclick = () => go(true);
  document.getElementById('cheatbtn').onclick = () => {
    out.innerHTML = '<div class="outmsg">' + [
      'git commit -m "message"      make a commit here',
      'git branch <name>            create a label, stay where you are',
      'git checkout -b <name>       create a label and move onto it',
      'git checkout <name>          move onto an existing branch',
      'git merge <name>             merge that branch into this one',
      'git merge --no-ff <name>     merge, forcing a merge commit',
      'git rebase <name>            replay this branch on top of that one',
      'git reset --hard <rev>       move this branch back to <rev>',
      'git revert <rev>             add a commit undoing <rev>',
      'git cherry-pick <rev>        copy one commit onto this branch',
      'git log --oneline            list the history',
      'git status                   where am I?',
      '',
      'Revisions: HEAD, HEAD~1, HEAD^2, a branch name, or a short hash.'
    ].join('\n') + '</div>';
  };
  document.getElementById('userin').addEventListener('keydown', e => {
    if((e.metaKey || e.ctrlKey) && e.key === 'Enter'){ e.preventDefault(); go(false); }
  });
}
