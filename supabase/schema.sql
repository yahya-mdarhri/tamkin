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
