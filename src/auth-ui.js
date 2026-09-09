/* ============================================================
   ACCOUNT UI

   Built in JS and appended on first use rather than shipped in the
   markup: someone who never signs in never pays for this, in bytes or
   in DOM. It is also the only part of the app that can fail for reasons
   outside the page -- network, provider, a wrong password -- so every
   path here ends in a sentence a person can act on, never a raw error
   code and never a silent nothing.
   ============================================================ */

let authEl = null, authMode = 'in';

function buildAuth(){
  if(authEl) return authEl;
  authEl = document.createElement('div');
  authEl.className = 'authwrap';
  authEl.id = 'authwrap';
  authEl.hidden = true;
  authEl.innerHTML = `
    <div class="authscrim" data-close></div>
    <div class="authbox" role="dialog" aria-modal="true" aria-labelledby="authttl">
      <button class="authx" data-close aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
      </button>

      <div data-when="out">
        <h2 id="authttl">Keep your progress</h2>
        <p class="authlede">Sign in and your solved exercises follow you to any browser.
          Without an account everything still works — it just stays on this device.</p>

        <button class="authbtn google" id="authGoogle">
          <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <div class="author"><span>or</span></div>

        <label class="authlabel" for="authEmail">Email</label>
        <input class="authinput" id="authEmail" type="email" autocomplete="email"
               placeholder="you@example.com" spellcheck="false">
        <label class="authlabel" for="authPass">Password</label>
        <input class="authinput" id="authPass" type="password"
               autocomplete="current-password" placeholder="At least 8 characters">

        <button class="authbtn primary" id="authGo">Sign in</button>
        <p class="authswap">
          <span data-mode="in">New here? <button class="authlink" id="authToggle">Create an account</button></span>
          <span data-mode="up" hidden>Already have one? <button class="authlink" id="authToggle2">Sign in</button></span>
        </p>
      </div>

      <div data-when="in" hidden>
        <h2>Your account</h2>
        <p class="authlede" id="authWho"></p>
        <button class="authbtn" id="authExport">Export my data</button>
        <button class="authbtn" id="authDelete">Delete my saved progress</button>
        <button class="authbtn ghost" id="authOut">Sign out</button>
        <p class="authfine">Export gives you every row we hold, as JSON. Delete removes
          them from the server; progress in this browser is kept until you use
          Reset progress.</p>
      </div>

      <p class="authmsg" id="authMsg" hidden></p>
    </div>`;
  document.body.appendChild(authEl);

  authEl.querySelectorAll('[data-close]').forEach(b => b.onclick = closeAuth);
  authEl.addEventListener('keydown', e => { if(e.key === 'Escape') closeAuth(); });

  const setMode = m => {
    authMode = m;
    authEl.querySelector('#authGo').textContent = m === 'in' ? 'Sign in' : 'Create account';
    authEl.querySelector('[data-mode="in"]').hidden = m !== 'in';
    authEl.querySelector('[data-mode="up"]').hidden = m !== 'up';
    authEl.querySelector('#authPass').autocomplete =
      m === 'in' ? 'current-password' : 'new-password';
    authMsg('');
  };
  authEl.querySelector('#authToggle').onclick  = () => setMode('up');
  authEl.querySelector('#authToggle2').onclick = () => setMode('in');

  authEl.querySelector('#authGoogle').onclick = withSb(async () => {
    const { error } = await sb.auth.signInWithOAuth({
      provider:'google',
      options:{ redirectTo: location.href.split('#')[0] }
    });
    if(error) authMsg(error.message, true);
  });

  authEl.querySelector('#authGo').onclick = withSb(async () => {
    const email = authEl.querySelector('#authEmail').value.trim();
    const pass  = authEl.querySelector('#authPass').value;
    if(!email){ authMsg('Enter your email address.', true); return; }
    if(pass.length < 8){ authMsg('Passwords need at least 8 characters.', true); return; }

    if(authMode === 'up'){
      const { data, error } = await sb.auth.signUp({ email, password: pass });
      if(error){ authMsg(error.message, true); return; }
      /* With email confirmation on, signUp returns a user but no session.
         Saying so beats leaving someone staring at an unchanged dialog. */
      if(data && data.user && !data.session){
        authMsg('Check ' + email + ' for a confirmation link, then sign in.');
        return;
      }
      await afterSignIn();
    }else{
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if(error){ authMsg(error.message, true); return; }
      await afterSignIn();
    }
  });

  authEl.querySelector('#authExport').onclick = () => acctExport();
  authEl.querySelector('#authDelete').onclick = () => acctDeleteData();
  authEl.querySelector('#authOut').onclick    = () => acctSignOut();
  return authEl;
}

/* Loads the SDK on demand and turns any failure into a sentence. */
function withSb(fn){
  return async () => {
    authMsg('Working…');
    try{
      await loadSb();
    }catch(e){
      authMsg('Could not reach the sign-in service. Check your connection — '
            + 'the exercises still work without an account.', true);
      return;
    }
    try{ await fn(); }
    catch(e){ authMsg(e.message || 'Something went wrong.', true); }
  };
}

async function afterSignIn(){
  const { data } = await sb.auth.getUser();
  sbUser = (data && data.user) || null;
  if(!sbUser){ authMsg('Signed in, but no account came back. Try again.', true); return; }
  authMsg('Signed in. Syncing your progress…');
  await pullMerge();
  paintAccount();
  authMsg('');
  closeAuth();
  if(typeof render === 'function') render();
}

function authMsg(text, bad){
  if(!authEl) return;
  const el = authEl.querySelector('#authMsg');
  el.textContent = text || '';
  el.hidden = !text;
  el.classList.toggle('bad', !!bad);
}

function openAuth(){
  buildAuth();
  authEl.querySelector('[data-when="out"]').hidden = !!sbUser;
  authEl.querySelector('[data-when="in"]').hidden  = !sbUser;
  if(sbUser) authEl.querySelector('#authWho').textContent = 'Signed in as ' + sbUser.email;
  authMsg('');
  authEl.hidden = false;
  const first = authEl.querySelector(sbUser ? '#authExport' : '#authGoogle');
  if(first) first.focus();
}

function closeAuth(){ if(authEl) authEl.hidden = true; }

/* The header button reflects state without adding a second control. */
function paintAccount(){
  const b = document.getElementById('acct');
  if(!b) return;
  b.classList.toggle('on', !!sbUser);
  b.setAttribute('aria-label', sbUser ? 'Your account' : 'Sign in to save progress');
  b.title = sbUser ? ('Signed in as ' + sbUser.email) : 'Sign in to save progress';
}
