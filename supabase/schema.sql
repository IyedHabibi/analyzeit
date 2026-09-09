-- AnalyzeIt — progress sync schema
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent: running it twice is harmless.
--
-- The security model is Row Level Security, not application code. The browser
-- holds a publishable key that anyone can read out of the page, so the client
-- is not trusted with anything. Postgres itself refuses to return or accept a
-- row whose user_id is not the caller's. If every line of JavaScript in this
-- app were rewritten by an attacker, they still could not read another user's
-- rows.

-- ---------------------------------------------------------------------------
-- progress: one row per solved exercise, per user.
--
-- Data minimisation is the design: there is no name, no avatar, no activity
-- log, no IP, no "last seen". The only facts stored are *which exercises this
-- account has solved* and when. Identity lives in auth.users, which Supabase
-- manages, and which we never copy out of.
--
-- ON DELETE CASCADE matters for erasure: deleting the auth user removes every
-- progress row with it, so a GDPR Article 17 request is one delete, not a
-- cleanup script that can miss a table.
-- ---------------------------------------------------------------------------
create table if not exists public.progress (
  user_id   uuid        not null references auth.users(id) on delete cascade,
  ex_key    text        not null,
  solved_at timestamptz not null default now(),
  primary key (user_id, ex_key)
);

create index if not exists progress_user_idx on public.progress (user_id);

alter table public.progress enable row level security;

-- Four separate policies rather than one FOR ALL: a single permissive policy
-- is easy to write too loosely, and mistakes in it are silent. Split, each one
-- states exactly what it permits, and USING/WITH CHECK are both spelled out so
-- a row can be neither read nor written across accounts.
drop policy if exists "read own progress"   on public.progress;
drop policy if exists "insert own progress" on public.progress;
drop policy if exists "update own progress" on public.progress;
drop policy if exists "delete own progress" on public.progress;

create policy "read own progress" on public.progress
  for select using (auth.uid() = user_id);

create policy "insert own progress" on public.progress
  for insert with check (auth.uid() = user_id);

create policy "update own progress" on public.progress
  for update using (auth.uid() = user_id)
              with check (auth.uid() = user_id);

create policy "delete own progress" on public.progress
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Nothing else. No profiles table, no analytics table, no events table.
-- Every table added here is a table that has to appear in the privacy policy,
-- be covered by an export, and be deleted on request. Add one only when a
-- feature genuinely cannot work without it.
-- ---------------------------------------------------------------------------
