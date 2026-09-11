/* ============================================================
   ACCOUNT UI — email, then a six-digit code

   No passwords anywhere. `signInWithOtp` creates the account if the
   address is new and signs in if it is not, so one flow covers both and
   there is nothing for anyone to forget, reuse, or leak. It also removes
   password storage from the threat model entirely.

   The code verifies the instant the sixth digit lands -- no submit
   button. A button after a six-digit code is a step that exists only to
   be clicked, and every person who types the code then looks for it has
   been made to do work the machine could have done.

   Built in JS on first use, so a visitor who never signs in pays for
   none of this in bytes or DOM.
   ============================================================ */

let authEl = null;
let otpEmail = '';          /* the address the current code was sent to */
let otpBusy = false;        /* one verify in flight at a time */
let resendAt = 0;           /* epoch ms when Resend becomes available */
let resendTimer = null;
let pendingGo = null;       /* where to send them once they are in */

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

      <div data-step="email">
        <h2 id="authttl">Sign in to start</h2>
        <p class="authlede">One click with Google, or we&rsquo;ll email you a
          six-digit code. No password to create, and none to forget.</p>

        <!-- Shown only when GOOGLE_READY says the provider is actually
             enabled in Supabase. signInWithOAuth navigates the whole page
             away, so a disabled provider cannot surface as an error this
             code could catch -- it lands the user on raw JSON. -->
        <button class="authbtn google" id="authGoogle" hidden>
          <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>
        <div class="author" id="authOr" hidden><span>or</span></div>

        <label class="authlabel" for="authEmail">Email</label>
        <input class="authinput" id="authEmail" type="email" inputmode="email"
               autocomplete="email" placeholder="you@example.com" spellcheck="false">
        <button class="authbtn primary" id="authSend">Send code</button>
      </div>

      <div data-step="code" hidden>
        <h2>Check your email</h2>
        <p class="authlede">We sent a six-digit code to <b id="authWhere"></b>.
          It expires in a few minutes.</p>
        <!-- Supabase's built-in email service does not allow template edits,
             so until custom SMTP is configured its default message contains a
             sign-in LINK rather than a {{ .Token }} code. Clicking that link
             works -- syncBoot() reads the credentials it returns with. Saying
             so here keeps the dialog honest in both configurations instead of
             leaving someone staring at six boxes with nothing to type. -->
        <p class="authfine">If the email contains a link instead of a code,
          clicking it signs you in too.</p>
        <div class="otprow" id="otprow" role="group" aria-label="Six-digit code">
          ${[0,1,2,3,4,5].map(i => `<input class="otpbox" inputmode="numeric"
             autocomplete="${i === 0 ? 'one-time-code' : 'off'}" maxlength="1"
             aria-label="Digit ${i + 1}" data-i="${i}">`).join('')}
        </div>
        <p class="authswap">
          <button class="authlink" id="authResend">Resend code</button>
          <span class="sep">&middot;</span>
          <button class="authlink" id="authBack">Use a different email</button>
        </p>
      </div>

      <div data-step="in" hidden>
        <h2>Your account</h2>
        <p class="authlede" id="authWho"></p>

        <label class="authlabel" for="authName">Display name</label>
        <div class="authrow">
          <input class="authinput" id="authName" type="text" maxlength="40"
                 autocomplete="nickname" placeholder="What should we call you?"
                 spellcheck="false">
          <button class="authbtn compact" id="authSaveName">Save</button>
        </div>

        <button class="authbtn ghost" id="authOut">Sign out</button>

        <!-- Export and delete are legal obligations, not features: GDPR
             Articles 15 and 20 give every user the right to a copy of
             their data, and 17 the right to have it erased. Self-serve
             is both kinder and cheaper than fielding email requests.
             They are fine print because almost nobody needs them, not
             because they are optional. -->
        <p class="authfine" id="authData">Your data:
          <button class="authlink" id="authExport">download a copy</button>
          <span class="sep">&middot;</span>
          <button class="authlink" id="authDelete">delete saved progress</button>
        </p>
      </div>

      <p class="authmsg" id="authMsg" hidden></p>
    </div>`;
  document.body.appendChild(authEl);

  authEl.querySelectorAll('[data-close]').forEach(b => b.onclick = closeAuth);
  authEl.addEventListener('keydown', e => { if(e.key === 'Escape') closeAuth(); });

  authEl.querySelector('#authGoogle').onclick = async () => {
    authMsg('Opening Google\u2026');
    try{ await loadSb(); }
    catch(e){
      authMsg('Could not reach the sign-in service. Check your connection.', true);
      return;
    }
    /* redirectTo must be an origin listed in Supabase's Redirect URLs, or
       the round trip completes and then dead-ends. Stripping the fragment
       matters: a stale #access_token in the current URL would otherwise be
       carried into the redirect target. */
    const { error } = await sb.auth.signInWithOAuth({
      provider:'google',
      options:{ redirectTo: location.origin + location.pathname }
    });
    if(error) authMsg(error.message, true);
  };

  const email = authEl.querySelector('#authEmail');
  email.addEventListener('keydown', e => { if(e.key === 'Enter') sendCode(); });
  authEl.querySelector('#authSend').onclick = () => sendCode();
  authEl.querySelector('#authResend').onclick = () => sendCode(true);
  authEl.querySelector('#authBack').onclick = () => { authStep('email'); authMsg(''); };
  authEl.querySelector('#authExport').onclick = () => acctExport();
  authEl.querySelector('#authDelete').onclick = () => acctDeleteData();
  authEl.querySelector('#authOut').onclick    = () => acctSignOut();
  authEl.querySelector('#authSaveName').onclick = () => saveName();
  authEl.querySelector('#authName').addEventListener('keydown', e => {
    if(e.key === 'Enter') saveName();
  });

  wireOtp(authEl.querySelector('#otprow'));
  return authEl;
}

/* ---------- the code boxes ---------- */
function otpValue(){
  return [...authEl.querySelectorAll('.otpbox')].map(b => b.value).join('');
}
function otpClear(focus){
  authEl.querySelectorAll('.otpbox').forEach(b => { b.value = ''; b.classList.remove('bad'); });
  if(focus) authEl.querySelector('.otpbox').focus();
}

function wireOtp(row){
  const boxes = [...row.querySelectorAll('.otpbox')];

  const maybeVerify = () => {
    const v = otpValue();
    if(v.length === 6 && /^\d{6}$/.test(v)) verifyCode(v);
  };

  boxes.forEach((b, i) => {
    b.addEventListener('input', () => {
      /* Strip anything that is not a digit rather than rejecting the
         keystroke: phone keyboards and autofill both deliver characters
         this field never asked for. */
      b.value = b.value.replace(/\D/g, '').slice(0, 1);
      b.classList.remove('bad');
      if(b.value && i < boxes.length - 1) boxes[i + 1].focus();
      maybeVerify();
    });

    b.addEventListener('keydown', e => {
      if(e.key === 'Backspace' && !b.value && i > 0){
        boxes[i - 1].focus(); boxes[i - 1].value = ''; e.preventDefault();
      }
      if(e.key === 'ArrowLeft'  && i > 0) boxes[i - 1].focus();
      if(e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
    });

    /* One paste fills the row. Without this, pasting a code from the
       email drops five of its six digits into a maxlength=1 box. */
    b.addEventListener('paste', e => {
      const t = (e.clipboardData || window.clipboardData).getData('text') || '';
      const d = t.replace(/\D/g, '').slice(0, 6);
      if(!d) return;
      e.preventDefault();
      boxes.forEach((x, j) => { x.value = d[j] || ''; });
      boxes[Math.min(d.length, 5)].focus();
      maybeVerify();
    });
  });
}

/* ---------- steps ---------- */
function authStep(step){
  ['email','code','in'].forEach(s => {
    const el = authEl.querySelector(`[data-step="${s}"]`);
    if(el) el.hidden = s !== step;
  });
  if(step === 'code'){
    otpClear(true);
    authEl.querySelector('#authWhere').textContent = otpEmail;
    tickResend();
  }
  if(step === 'email') setTimeout(() => authEl.querySelector('#authEmail').focus(), 30);
}

function tickResend(){
  clearInterval(resendTimer);
  const btn = authEl && authEl.querySelector('#authResend');
  if(!btn) return;
  const paint = () => {
    const left = Math.ceil((resendAt - Date.now()) / 1000);
    if(left > 0){
      btn.disabled = true;
      btn.textContent = `Resend code in ${left}s`;
    }else{
      btn.disabled = false;
      btn.textContent = 'Resend code';
      clearInterval(resendTimer);
    }
  };
  paint();
  resendTimer = setInterval(paint, 1000);
}

/* ---------- actions ---------- */
async function sendCode(isResend){
  const input = authEl.querySelector('#authEmail');
  const addr  = (isResend ? otpEmail : input.value.trim()).toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)){
    authMsg('That does not look like an email address.', true);
    input.focus(); return;
  }
  authMsg('Sending…');
  try{ await loadSb(); }
  catch(e){
    authMsg('Could not reach the sign-in service. Check your connection.', true);
    return;
  }
  const { error } = await sb.auth.signInWithOtp({
    email: addr,
    options:{ shouldCreateUser: true }
  });
  if(error){ authMsg(error.message, true); return; }
  otpEmail = addr;
  resendAt = Date.now() + 60000;      /* Supabase rate-limits resends */
  authStep('code');
  authMsg(isResend ? 'A new code is on its way.' : '');
}

async function verifyCode(token){
  if(otpBusy) return;
  otpBusy = true;
  authMsg('Checking…');
  try{
    const { error } = await sb.auth.verifyOtp({
      email: otpEmail, token, type:'email'
    });
    if(error){
      /* Wrong or expired: say which, clear the row, and put the cursor
         back. Leaving six wrong digits on screen invites retyping over
         them, which is how people end up with seven. */
      authEl.querySelectorAll('.otpbox').forEach(b => b.classList.add('bad'));
      authMsg(/expired/i.test(error.message)
        ? 'That code has expired. Send a new one.'
        : 'That code is not right. Check the email and try again.', true);
      setTimeout(() => otpClear(true), 700);
      return;
    }
    await afterSignIn();
  }catch(e){
    authMsg(e.message || 'Something went wrong.', true);
  }finally{
    otpBusy = false;
  }
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
  /* Straight to wherever they were headed when the gate stopped them. */
  const go = pendingGo; pendingGo = null;
  if(go && typeof goto === 'function') goto(go[0], go[1]);
  else if(typeof render === 'function') render();
}

/* Stored in the auth user's own metadata rather than a profiles table.
   A second table would need its own RLS policies, its own row in the
   privacy policy, its own line in the export and its own delete path --
   a lot of surface for one string. This travels with the account and is
   removed when the account is. */
function displayName(){
  return (sbUser && sbUser.user_metadata && sbUser.user_metadata.display_name) || '';
}

async function saveName(){
  if(!sb || !sbUser) return;
  const input = authEl.querySelector('#authName');
  const name = input.value.trim().slice(0, 40);
  authMsg('Saving…');
  const { data, error } = await sb.auth.updateUser({ data:{ display_name: name } });
  if(error){ authMsg(error.message, true); return; }
  if(data && data.user) sbUser = data.user;
  paintAccount();
  authEl.querySelector('#authWho').textContent = whoLine();
  authMsg(name ? 'Saved.' : 'Display name cleared.');
}

function whoLine(){
  const n = displayName();
  return n ? (n + ' \u00b7 ' + sbUser.email) : ('Signed in as ' + sbUser.email);
}

function authMsg(text, bad){
  if(!authEl) return;
  const el = authEl.querySelector('#authMsg');
  el.textContent = text || '';
  el.hidden = !text;
  el.classList.toggle('bad', !!bad);
}

function openAuth(opts){
  buildAuth();
  /* A Google sign-in navigates away and comes back, so pendingGo cannot
     survive in memory. Park it where the return trip can find it. */
  if(opts && opts.go){
    try{ sessionStorage.setItem('ai.pendingGo', opts.go.join(':')); }catch(e){}
  }
  /* Never offer a provider that is switched off -- see GOOGLE_READY. */
  const gb = authEl.querySelector('#authGoogle'), gor = authEl.querySelector('#authOr');
  const ready = (typeof GOOGLE_READY !== 'undefined' && GOOGLE_READY);
  if(gb)  gb.hidden  = !ready;
  if(gor) gor.hidden = !ready;
  const o = opts || {};
  if(o.go) pendingGo = o.go;
  authEl.querySelector('#authttl').textContent = o.title || 'Sign in to start';
  authStep(sbUser ? 'in' : (otpEmail ? 'code' : 'email'));
  if(sbUser){
    authEl.querySelector('#authWho').textContent = whoLine();
    authEl.querySelector('#authName').value = displayName();
  }
  authMsg('');
  authEl.hidden = false;
}

function closeAuth(){
  if(authEl) authEl.hidden = true;
  clearInterval(resendTimer);
}

/* The header button reflects state without adding a second control. */
function paintAccount(){
  const b = document.getElementById('acct');
  if(!b) return;
  b.classList.toggle('on', !!sbUser);
  b.setAttribute('aria-label', sbUser ? 'Your account' : 'Sign in to save progress');
  b.title = sbUser ? whoLine() : 'Sign in to save progress';
}
