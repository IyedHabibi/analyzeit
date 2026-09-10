/* ============================================================
   GIT CURRICULUM — three levels, all machine-checked against the
   DAG simulator in git-engine.js.

   Grading compares repository SHAPE, not the commands typed, so a
   learner who reaches the right history by a different route is
   marked correct. That is deliberate: in git there is usually more
   than one way, and marking the alternative wrong teaches a
   superstition rather than a skill.
   ============================================================ */

Object.assign(LESSONS, {

'git-0':{
  title:'Commits, branches and where HEAD points',
  scenario:'You join a team and are told: <b>"branch off main, do the work, don\'t commit to main directly."</b> Nobody explains what a branch actually is, and the diagram on the wiki is three years out of date.',
  concept:`<p>A commit is a snapshot plus a pointer to the commit that came before it. String those together and you get a chain — that chain is your history.</p>
<ul><li>A <b>branch is not a copy</b>. It is a movable label pointing at one commit. Creating one is instant and costs nothing, which is why teams make so many.</li>
<li><code>HEAD</code> is the label that says <em>where you are</em>. Usually it points at a branch, and that branch points at a commit.</li>
<li><code>git commit</code> makes a new commit whose parent is wherever HEAD is, then drags the current branch forward with it. <b>Other branches do not move.</b></li>
<li><code>git checkout -b feature</code> is two steps at once: create the label <code>feature</code> here, then move HEAD onto it.</li></ul>
<p>The thing that confuses everyone at the start: after <code>git checkout -b feature</code>, <code>main</code> and <code>feature</code> point at the <em>same commit</em>. They only separate once you commit. A branch you have not committed on is indistinguishable from the one you made it from.</p>`,
  example:'git checkout -b feature\ngit commit -m "add report query"\ngit commit -m "fix column name"\ngit log --oneline',
  task:'Create a branch called <code>analysis</code>, switch to it, and make one commit with the message <code>first pass</code>.',
  solution:'git checkout -b analysis\ngit commit -m "first pass"',
  hint:'One command creates and switches; the second commits. Check the graph — main should stay where it was.'
},

'git-1':{
  title:'Merging, and what a merge commit really is',
  scenario:'Your branch is finished and needs to go back into <code>main</code>. A colleague warns you that <b>"the last person who did this lost a day of work."</b> Understanding the two kinds of merge is what stops that happening to you.',
  concept:`<p>There are two outcomes when you merge, and git picks between them based on the shape of the history.</p>
<p><b>Fast-forward.</b> If <code>main</code> has not moved since you branched, there is nothing to reconcile — git just slides the <code>main</code> label forward to your commit. <b>No merge commit is created.</b> The history stays a straight line, and looking at it later you cannot tell a branch ever existed.</p>
<p><b>Three-way merge.</b> If both branches have new commits, git finds the commit they last shared — the <em>merge base</em> — and combines both sets of changes into a new commit with <b>two parents</b>. That two-parent commit is the merge.</p>
<ul><li><code>git merge feature</code> merges <em>into</em> the branch you are currently on. Being on the wrong branch is the single most common mistake here — check with <code>git status</code> first.</li>
<li>The first parent is the branch you were on; the second is the one you merged in. That order is why <code>HEAD^1</code> and <code>HEAD^2</code> give different commits.</li>
<li><code>--no-ff</code> forces a merge commit even when a fast-forward was possible. Teams use it so the history records that a branch existed.</li></ul>`,
  example:'git checkout -b feature\ngit commit -m "new metric"\ngit checkout main\ngit commit -m "hotfix"\ngit merge feature',
  task:'Starting from the initial commit: branch to <code>feature</code> and commit <code>feature work</code>; then go back to <code>main</code>, commit <code>main work</code>, and merge <code>feature</code> in.',
  solution:'git checkout -b feature\ngit commit -m "feature work"\ngit checkout main\ngit commit -m "main work"\ngit merge feature',
  hint:'Because both branches moved, this cannot fast-forward — you should end with a commit that has two parents.'
},

'git-2':{
  title:'Rewriting history: rebase, reset and revert',
  scenario:'You committed an API key. It is in the history of a branch you have already pushed. <b>The fix you choose depends entirely on who else has that history</b> — and picking wrong is how teams lose work.',
  concept:`<p>Three commands undo things, and they are not interchangeable.</p>
<ul><li><b><code>git revert X</code></b> makes a <em>new</em> commit that undoes X. Nothing is rewritten, so it is always safe on shared branches. The history keeps the mistake and the correction — which is honest, and sometimes exactly what an auditor wants.</li>
<li><b><code>git reset --hard X</code></b> moves the branch label back to X. The commits after it are not deleted, but nothing points to them any more, so they effectively vanish. Safe on your own local work; <b>destructive on anything anyone else has pulled.</b></li>
<li><b><code>git rebase main</code></b> replays your commits on top of main, one at a time. The result is a straight line with no merge commit.</li></ul>
<p>The part people miss: <b>a rebase does not move your commits, it copies them.</b> A replayed commit has a different parent, so it is a different commit with a different hash — even though the message is identical. The originals are still in the repository, just unreferenced. This is the whole reason for the rule <em>"never rebase a branch someone else is working on"</em>: their copy and your copy are now different objects, and git cannot tell they were meant to be the same.</p>
<p><code>git cherry-pick X</code> is the same copying mechanic aimed at a single commit — useful for lifting one fix out of a branch you are not ready to merge.</p>`,
  example:'git checkout -b feature\ngit commit -m "step one"\ngit checkout main\ngit commit -m "unrelated"\ngit checkout feature\ngit rebase main',
  task:'Branch to <code>feature</code> and commit <code>step one</code>. Return to <code>main</code> and commit <code>unrelated</code>. Then rebase <code>feature</code> onto <code>main</code> so its history is linear.',
  solution:'git checkout -b feature\ngit commit -m "step one"\ngit checkout main\ngit commit -m "unrelated"\ngit checkout feature\ngit rebase main',
  hint:'You have to be on the branch being rebased when you run rebase. Afterwards no commit should have two parents.'
}

});

Object.assign(EX, {

'git-0':[
 {task:'Create a branch called <code>analysis</code>, switch to it, and make one commit with the message <code>first pass</code>.',
  solution:'git checkout -b analysis\ngit commit -m "first pass"',
  hint:'<code>git checkout -b</code> creates and switches in one step.', data:'git-repo'},
 {task:'Make two commits on <code>main</code>, with messages <code>load data</code> then <code>clean data</code>, in that order.',
  solution:'git commit -m "load data"\ngit commit -m "clean data"',
  hint:'No branching needed. The second commit\'s parent is the first.', data:'git-repo'},
 {task:'Create a branch <code>experiment</code> but <b>stay on main</b>, then commit <code>main moves on</code>. The experiment branch must not move.',
  solution:'git branch experiment\ngit commit -m "main moves on"',
  hint:'<code>git branch</code> creates a label without switching to it — that is the difference from <code>checkout -b</code>.', data:'git-repo'},
 {task:'Create <code>cleanup</code> and switch to it, then make two commits: <code>drop empty rows</code> then <code>fix column names</code>.',
  solution:'git checkout -b cleanup\ngit commit -m "drop empty rows"\ngit commit -m "fix column names"',
  hint:'One checkout, then two commits. Both land on cleanup, not on main.', data:'git-repo'},
 {task:'Make a commit <code>add report</code> on <code>main</code>, then create <code>review</code> from that point and switch to it. Both branches must sit on the same commit.',
  solution:'git commit -m "add report"\ngit branch review\ngit checkout review',
  hint:'A new branch starts wherever HEAD is. Create it after the commit and both labels point at the same place.', data:'git-repo'},
 {task:'Create <code>a</code> and <code>b</code> from <code>main</code> without switching to either, then commit <code>main only</code> on main. Both new branches must stay behind.',
  solution:'git branch a\ngit branch b\ngit commit -m "main only"',
  hint:'git branch labels the current commit and leaves you where you are — that is what keeps a and b behind.', data:'git-repo'},
],

'git-1':[
 {task:'Branch to <code>feature</code> and commit <code>feature work</code>; return to <code>main</code>, commit <code>main work</code>, then merge <code>feature</code> into main.',
  solution:'git checkout -b feature\ngit commit -m "feature work"\ngit checkout main\ngit commit -m "main work"\ngit merge feature',
  hint:'Both branches moved, so this produces a merge commit with two parents.', data:'git-repo'},
 {task:'Branch to <code>quickfix</code>, commit <code>the fix</code>, then go back to <code>main</code> and merge it. <code>main</code> must not gain a merge commit.',
  solution:'git checkout -b quickfix\ngit commit -m "the fix"\ngit checkout main\ngit merge quickfix',
  hint:'main has not moved, so this fast-forwards — the label just slides forward and no merge commit is made.', data:'git-repo'},
 {task:'Same as the fast-forward case — branch <code>release</code>, commit <code>ship it</code>, return to <code>main</code> — but force a merge commit anyway so the history records that a branch existed.',
  solution:'git checkout -b release\ngit commit -m "ship it"\ngit checkout main\ngit merge --no-ff release',
  hint:'There is a flag that refuses to fast-forward.', data:'git-repo'},
 {task:'Branch to <code>charts</code>, commit <code>add bar chart</code>, then return to <code>main</code> and merge it. main has not moved, so no merge commit should appear.',
  solution:'git checkout -b charts\ngit commit -m "add bar chart"\ngit checkout main\ngit merge charts',
  hint:'When main has no commits of its own since the split, git just slides the label forward.', data:'git-repo'},
 {task:'Two people, two branches. Commit <code>alice work</code> on <code>alice</code>, then <code>bob work</code> on <code>bob</code> branched from main, then merge <b>both</b> into main.',
  solution:'git checkout -b alice\ngit commit -m "alice work"\ngit checkout main\ngit checkout -b bob\ngit commit -m "bob work"\ngit checkout main\ngit merge alice\ngit merge bob',
  hint:'The second merge is the interesting one: main has moved by then, so it cannot just slide forward.', data:'git-repo'},
 {task:'Branch <code>hotfix</code>, commit <code>patch</code>, return to main and merge it keeping a merge commit even though it could fast-forward.',
  solution:'git checkout -b hotfix\ngit commit -m "patch"\ngit checkout main\ngit merge --no-ff hotfix',
  hint:'--no-ff forces the merge commit, so the history still shows that a branch existed.', data:'git-repo'},
],

'git-2':[
 {task:'Branch to <code>feature</code> and commit <code>step one</code>. Return to <code>main</code> and commit <code>unrelated</code>. Then rebase <code>feature</code> onto <code>main</code>.',
  solution:'git checkout -b feature\ngit commit -m "step one"\ngit checkout main\ngit commit -m "unrelated"\ngit checkout feature\ngit rebase main',
  hint:'Be standing on the branch you are rebasing. The result must be linear — no two-parent commits.', data:'git-repo'},
 {task:'Commit <code>leaked key</code> on main, then undo it in the way that is <b>safe on a branch other people have already pulled</b>.',
  solution:'git commit -m "leaked key"\ngit revert HEAD',
  hint:'Safe means adding a commit that undoes it, not removing the commit.', data:'git-repo'},
 {task:'Commit <code>work in progress</code> then <code>bad commit</code> on main, then discard only the last one so <code>work in progress</code> is the tip. This is local-only work, so rewriting is fine.',
  solution:'git commit -m "work in progress"\ngit commit -m "bad commit"\ngit reset --hard HEAD~1',
  hint:'Move the branch label back one commit from where HEAD is.', data:'git-repo'},
 {task:'Commit <code>draft</code> then <code>typo</code> on main, then undo <b>both</b> so main sits back where it started, keeping nothing.',
  solution:'git commit -m "draft"\ngit commit -m "typo"\ngit reset --hard HEAD~2',
  hint:'HEAD~2 is two commits back. --hard discards the work as well as moving the label.', data:'git-repo'},
 {task:'Commit <code>feature a</code> on a branch <code>work</code>, then rebase it onto main after main gains <code>main update</code>. The history must end up linear.',
  solution:'git checkout -b work\ngit commit -m "feature a"\ngit checkout main\ngit commit -m "main update"\ngit checkout work\ngit rebase main',
  hint:'Rebase replays your commits on top of the other branch, so no merge commit is created.', data:'git-repo'},
 {task:'Commit <code>good</code> then <code>bad</code> on main. Undo only <code>bad</code>, but in a way that leaves the original commit visible in the history.',
  solution:'git commit -m "good"\ngit commit -m "bad"\ngit revert HEAD',
  hint:'revert adds a new commit that cancels the old one. reset would erase it — unsafe once pushed.', data:'git-repo'},
],

});

Object.assign(PREVIEW, {
  'git-repo':{title:'starting repository',
    cols:['commit','message','branch'],
    rows:[['(root)','initial commit','main']],
    note:'Every exercise starts from this one-commit repository on branch main. Your commands run against a fresh copy each time, so you can experiment freely — there is nothing to break.'}
});
