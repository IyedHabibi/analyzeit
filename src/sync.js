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

/* Set to true once Authentication -> Providers -> Google is enabled in
   Supabase. Until then the button stays hidden, because
   signInWithOAuth redirects the page and a disabled provider lands
   the user on raw JSON instead of an error this code can show. */
const GOOGLE_READY = false;

const SB_URL = 'https://jrsxhwmlhenupoyjlzeu.supabase.co';
const SB_KEY = 'sb_publishable_vc61agF-MFY2WGOiZpW_pg_rcU_1Sm8';

/* Major-pinned rather than exact. Pin the precise version once you have
   confirmed one, so a bad upstream release cannot reach your users. */
const SB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

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

function loadSb(){
  if(sbLoading) return sbLoading;
  sbLoading = new Promise((resolve, reject) => {
    if(window.supabase && window.supabase.createClient) return resolve(window.supabase);
    const s = document.createElement('script');
    s.src = SB_CDN;
    s.onload = () => (window.supabase && window.supabase.createClient)
      ? resolve(window.supabase)
      : reject(new Error('Supabase loaded but exposed no client'));
    s.onerror = () => reject(new Error('Could not reach the sign-in service'));
    document.head.appendChild(s);
  }).then(lib => {
    sb = sb || lib.createClient(SB_URL, SB_KEY, {
      auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    return sb;
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
        if(typeof render === 'function') render();
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
