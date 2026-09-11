// Self-serve account deletion — GDPR Article 17.
//
// WHY THIS RUNS ON A SERVER AND NOT IN THE PAGE
//
// The browser can already delete its own progress rows: Row Level Security
// lets an account delete what it owns. What it cannot do is delete the
// account itself, because the row lives in auth.users, which only the
// service_role key may touch. That key bypasses RLS entirely — it can read
// and rewrite every row belonging to every user. Shipping it to a browser
// would hand that power to anyone who opens View Source. So the deletion
// happens here, where the key never leaves Supabase's servers.
//
// DEPLOY
//   Dashboard → Edge Functions → Deploy a new function → name it
//   `delete-account`, paste this file, deploy. Or, with the CLI:
//   `supabase functions deploy delete-account`.
//
// NO SECRETS TO SET. Supabase injects SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY into every function's environment. Nothing is
// pasted anywhere, and nothing lands in this repository.

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Only these origins may call this. A wildcard would let any page on the
// internet fire this request with a stolen-in-transit token; naming the
// origins keeps a browser from even sending it.
const ALLOWED = new Set([
  'https://analyzeit.dev',
  'https://www.analyzeit.dev',
  'https://analyzeit-app.netlify.app',
  'http://localhost:8713',
]);

function cors(origin: string | null) {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Vary': 'Origin',
  };
  if (origin && ALLOWED.has(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = { ...cors(origin), 'Content-Type': 'application/json' };

  // Preflight.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  // WHOSE ACCOUNT GETS DELETED IS NOT AN ARGUMENT.
  //
  // The id comes from verifying the caller's own access token, never from
  // the request body. If it came from the body, anyone holding any valid
  // token could post somebody else's id and delete their account. This is
  // the single most important line in the file.
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401, headers });
  }

  const asCaller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: { user }, error: whoErr } = await asCaller.auth.getUser();
  if (whoErr || !user) {
    // An expired or forged token lands here. Say nothing about which.
    return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401, headers });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // progress.user_id is ON DELETE CASCADE against auth.users, so deleting
  // the user takes every progress row with it. Deleting the rows first
  // anyway means a failure halfway through leaves an account with no data
  // rather than data with no account — the safer of the two half-states,
  // and the one the user asked for.
  const { error: rowsErr } = await admin.from('progress').delete().eq('user_id', user.id);
  if (rowsErr) {
    return new Response(JSON.stringify({ error: 'Could not delete your progress.' }), { status: 500, headers });
  }

  const { error: userErr } = await admin.auth.admin.deleteUser(user.id);
  if (userErr) {
    return new Response(JSON.stringify({ error: 'Could not delete your account.' }), { status: 500, headers });
  }

  // Deliberately terse. Error text is the sort of thing that leaks internals
  // to whoever is poking at the endpoint; the server log has the detail.
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
