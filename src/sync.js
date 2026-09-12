/* ============================================================
   ACCOUNTS AND PROGRESS SYNC

   Three properties this file must not break, in order:

   1. THE APP WORKS WITH NO ACCOUNT. Signing in is opt-in. With no
      account, nothing here runs, no network call is made, and progress
      lives in localStorage exactly as it did before. That is not a
      fallback -- it is the product's original promise, and it stays
      true for anyone who never signs up.

   2. THE APP WORKS OFFLINE, AND WHEN THE CDN IS BLOCKED. The SDK is
      loaded lazily and every failure path is silent-and-local. If
      jsDelivr is unreachable, you get the anonymous app, not an error.

   3. LOCAL IS THE WORKING COPY. Solving writes to localStorage first
      and pushes afterwards. A failed push never costs you the answer
      you just got right.

   Security note: the key below is the *publishable* key and is meant to
   be readable in page source. It grants nothing on its own. Every row
   is protected by Row Level Security in Postgres (see supabase/schema.sql)
   which refuses to return or accept rows belonging to another user. The
   service-role key must never appear in this file or any file that ships.
   ============================================================ */

/* Google is enabled in Supabase (Authentication -> Providers), so the
   button is shown. Set this back to false if the provider is ever turned
   off: signInWithOAuth redirects the whole page, so a disabled provider
   cannot surface as an error this code can catch -- it dumps the user on
   a raw JSON page instead. Absent beats present-and-broken. */
const GOOGLE_READY = true;

const SB_URL = 'https://jrsxhwmlhenupoyjlzeu.supabase.co';
const SB_KEY = 'sb_publishable_vc61agF-MFY2WGOiZpW_pg_rcU_1Sm8';

/* Pinned exactly, and hashed. `@2` resolved to whatever the latest 2.x was
   at page load, which meant two things: an upstream release could reach
   users untested, and Subresource Integrity was impossible -- a moving
   target has no stable hash. Bumping this is now a deliberate act:
   change the version, recompute the hash, test, ship. */
const SB_VERSION = '2.116.0';
const SB_PATH = '/@supabase/supabase-js@' + SB_VERSION + '/dist/umd/supabase.js';
/* Two hosts, tried in order. Both serve the same npm tarball, so the bytes
   are identical and ONE hash covers both -- verified, not assumed. A single
   CDN is a single point of failure for sign-in, and not a rare one: ad
   blockers, corporate proxies and some national networks block jsdelivr
   outright. The page itself still loads from Netlify, so the site looks
   perfectly healthy while signing in is impossible. That is exactly the
   failure one user hit. */
const SB_CDNS = [
  'https://cdn.jsdelivr.net/npm' + SB_PATH,
  'https://unpkg.com' + SB_PATH
];
const SB_CDN = SB_CDNS[0];
const SB_SRI = 'sha384-iLddHTLokph6Omwoyid4XKxHaWa6w41BnoEj0q5oOrzmYPpHIKt1wyjReA7s//pP';

let sb = null;                 /* the client, once loaded  */
let sbUser = null;             /* the signed-in user, or null */
let lastSynced = new Set();    /* what the server is believed to hold */
let sbLoading = null;

const exKeyRe = /^[a-z]+-\d+-\d+$/;   /* "sql-0-2"; lesson keys are derived */
const solvedKeys = () => new Set(Object.keys(state.done).filter(k => exKeyRe.test(k)));

/* Supabase parks its session under sb-<project-ref>-auth-token. Reading
   that first means an anonymous visitor never downloads the SDK at all. */
function hasStoredSession(){
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  }catch(e){}
  return false;
}

/* One <script> attempt. Resolves with the library, rejects if this host
   cannot deliver it. Integrity is set on every attempt: a fallback that
   drops the hash would turn a blocked CDN into a way to inject code. */
function loadSbFrom(url){
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.integrity = SB_SRI;
    s.crossOrigin = 'anonymous';
    s.async = true;
    s.onload = () => (window.supabase && window.supabase.createClient)
      ? resolve(window.supabase)
      : reject(new Error('loaded but exposed no client'));
    /* Fires for a network failure, a DNS block, an extension blocking the
       request, AND for an integrity mismatch. */
    s.onerror = () => { s.remove(); reject(new Error('could not load from ' + url)); };
    document.head.appendChild(s);
  });
}

function loadSb(){
  if(sbLoading) return sbLoading;
  sbLoading = (async () => {
    if(window.supabase && window.supabase.createClient) return window.supabase;
    let last = null;
    for(const url of SB_CDNS){
      try{ return await loadSbFrom(url); }
      catch(e){ last = e; console.warn('[sync]', e.message); }
    }
    throw last || new Error('no CDN reachable');
  })().then(lib => {
    sb = sb || lib.createClient(SB_URL, SB_KEY, {
      auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    return sb;
  }).catch(err => {
    /* Do NOT keep a rejected promise in sbLoading. It was cached like a
       success, so the first failure was permanent: every later click got
       the same rejection back without a single new request being made, and
       the only cure was a page reload. Clearing it makes "try again"
       actually try again. */
    sbLoading = null;
    throw err;
  });
  return sbLoading;
}

/* ---------- merge ----------
   Union, deliberately. Solved-on-either-side wins, so signing in on a
   second device can never lose work that only one of them knows about.
   The cost is that un-solving an exercise on one device does not erase
   it on the other at merge time; ongoing changes do propagate, because
   pushes are diffed below. Losing a solve is worse than keeping a stale
   one, so that is the trade taken. */
async function pullMerge(){
  if(!sb || !sbUser) return;
  const { data, error } = await sb.from('progress').select('ex_key, solved_at');
  if(error){ console.warn('[sync] pull failed:', error.message); return; }

  const remote = new Set(data.map(r => r.ex_key));
  const local  = solvedKeys();
  let changed = false;

  data.forEach(r => {
    if(!state.done[r.ex_key]){
      state.done[r.ex_key] = Date.parse(r.solved_at) || Date.now();
      changed = true;
    }
  });

  const missing = [...local].filter(k => !remote.has(k));
  if(missing.length) await pushAdds(missing);

  lastSynced = new Set([...local, ...remote]);
  if(changed){
    save();
    if(typeof reconcile === 'function') reconcile();
    if(typeof render === 'function') render();
  }
}

async function pushAdds(keys){
  if(!sb || !sbUser || !keys.length) return;
  const rows = keys.map(k => ({
    user_id: sbUser.id,
    ex_key: k,
    solved_at: new Date(state.done[k] || Date.now()).toISOString()
  }));
  const { error } = await sb.from('progress').upsert(rows, { onConflict:'user_id,ex_key' });
  if(error) console.warn('[sync] push failed:', error.message);
}

async function pushDeletes(keys){
  if(!sb || !sbUser || !keys.length) return;
  const { error } = await sb.from('progress').delete()
    .eq('user_id', sbUser.id).in('ex_key', keys);
  if(error) console.warn('[sync] delete failed:', error.message);
}

/* save() is the one choke point every progress change goes through, so
   wrapping it catches solving, un-solving and Reset progress alike
   without touching any of their call sites. Diffed against the last
   known server state rather than pushing everything each time. */
let pushTimer = null;
(function wrapSave(){
  const base = save;
  window.save = function(){
    base();
    if(!sb || !sbUser) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      const now = solvedKeys();
      const adds = [...now].filter(k => !lastSynced.has(k));
      const dels = [...lastSynced].filter(k => !now.has(k));
      lastSynced = now;
      if(adds.length) pushAdds(adds);
      if(dels.length) pushDeletes(dels);
    }, 400);
  };
})();

/* ---------- account actions ---------- */
async function acctExport(){
  if(!sb || !sbUser) return;
  const { data, error } = await sb.from('progress').select('ex_key, solved_at');
  if(error){ authMsg('Could not build the export: ' + error.message, true); return; }
  const blob = new Blob([JSON.stringify({
    exported_at: new Date().toISOString(),
    account: {
      id: sbUser.id,
      email: sbUser.email,
      display_name: (sbUser.user_metadata && sbUser.user_metadata.display_name) || null
    },
    solved: data
  }, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'analyzeit-my-data.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function acctDeleteData(){
  if(!sb || !sbUser) return;
  if(!confirm('Delete all saved progress from your account?\n\n'
            + 'This removes every solved exercise from the server. '
            + 'Progress stored in this browser is kept — use Reset progress to clear that too.')) return;
  const { error } = await sb.from('progress').delete().eq('user_id', sbUser.id);
  if(error){ authMsg('Delete failed: ' + error.message, true); return; }
  lastSynced = new Set();
  authMsg('Your saved progress has been deleted from the server.');
}

/* Erasure, GDPR Article 17 -- the whole account, not just its rows.
   This cannot be done from the browser: deleting a row in auth.users needs
   the service_role key, which bypasses every access rule and so must never
   reach a page. The request goes to an Edge Function that holds the key
   server-side; see supabase/functions/delete-account/index.ts.

   The function takes no user id. It reads the caller's own access token and
   deletes THAT account, so a tampered request can only ever delete the
   sender's own data. */
async function acctDeleteAccount(){
  if(!sb || !sbUser) return;
  const typed = prompt('This deletes your ACCOUNT: your email, your progress, '
    + 'everything, permanently. It cannot be undone.\n\n'
    + 'Type DELETE to confirm.');
  if(typed !== 'DELETE') return;

  authMsg('Deleting your account\u2026');
  let res;
  try{
    const { data:{ session } } = await sb.auth.getSession();
    if(!session){ authMsg('Your session expired. Sign in again and retry.', true); return; }
    res = await fetch(SB_URL + '/functions/v1/delete-account', {
      method:'POST',
      headers:{ 'Authorization':'Bearer ' + session.access_token, 'apikey': SB_KEY }
    });
  }catch(e){
    authMsg('Could not reach the server. Check your connection and retry.', true);
    return;
  }

  if(!res.ok){
    /* 404 means the Edge Function is not deployed. Saying so is better than
       a generic failure that sends someone hunting through their own
       browser for a problem that is not there. */
    let why = res.status === 404
      ? 'The deletion service is not available. Contact the author through the footer links.'
      : 'Deletion failed.';
    try{ const j = await res.json(); if(j && j.error) why = j.error; }catch(e){}
    authMsg(why, true);
    return;
  }

  /* The account is gone server-side. Clear the browser too -- leaving local
     progress behind would look like the deletion silently failed. */
  state.done = {};
  try{ localStorage.removeItem(KEY); }catch(e){}
  sbUser = null; lastSynced = new Set();
  try{ await sb.auth.signOut(); }catch(e){}
  alert('Your account and all of its data have been deleted.');
  location.reload();
}

async function acctSignOut(){
  if(!sb) return;
  await sb.auth.signOut();
  sbUser = null; lastSynced = new Set();
  closeAuth();
  if(typeof render === 'function') render();
}

/* Arriving FROM a confirmation email or an OAuth provider. Supabase
   sends the browser back carrying credentials -- tokens in the fragment
   for the implicit flow, or ?code= for PKCE -- and the SDK only reads
   them when the client is constructed.

   This exists because the lazy-load below shipped without it, and broke
   the single path that matters most: confirm your email, land back on
   the site, and be silently logged out. There was no stored session yet
   (you had never signed in on that browser), so the SDK never loaded,
   so the tokens sitting in the URL were never read. The optimisation
   was right; the exception to it was missing. */
function hasAuthCallback(){
  const h = location.hash || '', q = location.search || '';
  return /[#&](access_token|refresh_token)=/.test(h)
      || /[?&](code|error_description|error)=/.test(q)
      || /[#&](error|error_description)=/.test(h);
}

/* Tokens must not be left sitting in the address bar: they end up in
   history, in any link the user copies, and in the referrer. */
function scrubAuthUrl(){
  try{
    if(location.hash || location.search)
      history.replaceState({}, document.title, location.pathname);
  }catch(e){}
}

/* ---------- boot ---------- */
async function syncBoot(){
  const callback = hasAuthCallback();
  if(!hasStoredSession() && !callback) return;   /* anonymous: no network at all */
  try{
    await loadSb();

    /* detectSessionInUrl handles the implicit flow on construction. PKCE
       returns ?code= instead, and older SDK builds do not exchange it
       automatically, so do it explicitly when no session turned up. */
    let { data:{ session } = {} } = await sb.auth.getSession();
    const code = new URLSearchParams(location.search).get('code');
    if(!session && code && sb.auth.exchangeCodeForSession){
      try{
        const r = await sb.auth.exchangeCodeForSession(code);
        session = r.data && r.data.session;
      }catch(e){ console.warn('[sync] code exchange failed:', e.message); }
    }

    const { data } = await sb.auth.getUser();
    if(data && data.user){
      sbUser = data.user;
      await pullMerge();
      paintAccount();
      if(callback){
        scrubAuthUrl();
        /* Resume the journey the sign-in gate interrupted. */
        let go = null;
        try{
          const raw = sessionStorage.getItem('ai.pendingGo');
          if(raw){ sessionStorage.removeItem('ai.pendingGo'); go = raw.split(':'); }
        }catch(e){}
        if(go && typeof goto === 'function') goto(go[0], +go[1]);
        else if(typeof render === 'function') render();
      }
    }else if(callback){
      /* Landed back from a provider with nothing usable. Say so rather
         than leaving someone looking at a signed-out page wondering
         whether the click worked. */
      const err = new URLSearchParams(location.search).get('error_description')
               || new URLSearchParams(location.hash.replace(/^#/, '')).get('error_description');
      scrubAuthUrl();
      if(typeof openAuth === 'function'){
        openAuth();
        if(typeof authMsg === 'function')
          authMsg(err || 'That link did not sign you in. Try signing in below.', true);
      }
    }
  }catch(e){
    console.warn('[sync] offline or blocked; staying local:', e.message);
  }
}
