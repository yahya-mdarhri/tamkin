# Tamkin For Cities

Static platform (`tamkin-for-cities.html`) backed by Supabase for authentication
and per-commune data storage, deployed on Vercel.

## Architecture

- **Public/shared data** (methodology, criteria catalog, national aggregate
  stats, images) is embedded directly in `tamkin-for-cities.html`.
- **Per-commune confidential data** (self-assessment scores, observations,
  roadmap) lives in a `city_data` table in Supabase Postgres, protected by
  Row Level Security: a commune's account can only read its own row; the
  national (DGCT) account can read all of them. See `supabase/schema.sql`.
- **Authentication** is Supabase Auth (email/password). There are 9 fixed
  accounts: one per commune + one national account. No self-signup — accounts
  are provisioned with `scripts/seed.js`.

## One-time setup

1. **Create a Supabase project** at https://supabase.com (free tier is enough).
2. **Run the schema**: open the Supabase SQL editor and run the contents of
   `supabase/schema.sql`.
3. **Get your API keys** from Project Settings → API:
   - Project URL
   - `anon` `public` key (safe to expose client-side — RLS is what protects the data)
   - `service_role` key (SECRET — only used locally by the seed script, never committed or deployed)
4. **Wire the client** — in `tamkin-for-cities.html`, replace:
   ```js
   const SUPABASE_URL='__SUPABASE_URL__';
   const SUPABASE_ANON_KEY='__SUPABASE_ANON_KEY__';
   ```
   with your project's actual URL and anon key.
5. **Provision the 9 accounts + upload commune data**:
   ```bash
   npm install
   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run seed
   ```
   This reads each commune's data from `seed-data/cities/*.json` (already
   extracted from the original file, gitignored — never commit this folder)
   and writes generated credentials to `credentials.local.json` (also
   gitignored). Save those credentials somewhere safe (e.g. a password
   manager) and delete the file afterwards. Passwords can be rotated any time
   from the Supabase dashboard (Authentication → Users) or by re-running the
   seed script.

## Deploy to Vercel

This is a static site — no build step.

```bash
npm install -g vercel   # if not already installed
vercel                  # first deploy, follow the prompts
vercel --prod           # promote to production
```

`vercel.json` rewrites `/` to `/tamkin-for-cities.html` so the root URL serves
the app directly.

## Local development

Just open `tamkin-for-cities.html` in a browser, or serve the folder with any
static server (e.g. `npx serve`). Login will only work once the Supabase
credentials above are wired in and accounts are seeded.
