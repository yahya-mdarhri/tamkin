-- Tamkin For Cities — per-commune data store
--
-- Each row holds one commune's confidential evaluation data (self-assessment
-- scores, observations, roadmap). Row Level Security ensures a commune's
-- account can only ever read its own row, while the national (DGCT) account
-- can read all of them. There are no client-facing write policies: the app
-- is read-only; data is loaded/updated by the seed script using the service
-- role key, which bypasses RLS.

create table if not exists city_data (
  city text primary key,
  fiches jsonb not null,
  ev jsonb not null,
  synth jsonb not null,
  route jsonb not null,
  updated_at timestamptz not null default now()
);

alter table city_data enable row level security;

drop policy if exists "read own city or national" on city_data;
create policy "read own city or national" on city_data
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'national'
    or (auth.jwt() -> 'app_metadata' ->> 'commune') = city
  );

-- No insert/update/delete policy is defined, so ordinary (anon-key) clients
-- cannot write to this table at all — only the service role key can
-- (used exclusively by scripts/seed.js, run locally, never shipped to the app).

-- Panel-wide average score per objective (fid), computed live across all
-- communes. SECURITY DEFINER so it bypasses the row-level "own city only"
-- policy above — a commune account may not read another commune's row
-- directly, but it may read this aggregate, since averaging across 8
-- communes does not disclose any single commune's individual score.
-- Used by the app's "Lecture par ODD" views (national and per-commune) to
-- compare a commune against the panel without embedding a stale snapshot
-- in the static HTML.
create or replace function public.obj_panel()
returns table(fid text, pct numeric)
language sql
security definer
set search_path = public
as $$
  select (elem->>'fid')::text as fid, avg((elem->>'pct')::numeric) as pct
  from city_data, jsonb_array_elements(fiches) as elem
  group by elem->>'fid';
$$;

revoke all on function public.obj_panel() from public;
grant execute on function public.obj_panel() to authenticated;
