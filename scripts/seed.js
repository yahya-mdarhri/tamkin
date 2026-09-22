// One-time (or re-runnable) provisioning script.
//
// Creates the 9 fixed accounts (8 communes + 1 national) in Supabase Auth
// with app_metadata {role, commune} — the claims the RLS policy in
// supabase/schema.sql checks — and uploads each commune's confidential
// data into the city_data table.
//
// Run locally only. Needs the SERVICE ROLE key (never expose it to the
// browser or commit it):
//
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/seed.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CITIES_DIR = path.join(__dirname, '..', 'seed-data', 'cities');
const villes = fs.readdirSync(CITIES_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace(/\.json$/, ''));

function genPassword() {
  return crypto.randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
}

function emailFor(kind, v) {
  return kind === 'nat'
    ? 'dgct.national@tamkin-cities.app'
    : v.toLowerCase().replace(/\s+/g, '-') + '.commune@tamkin-cities.app';
}

async function upsertUser(email, password, app_metadata) {
  const { data: list, error: listErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;
  const existing = list.users.find(u => u.email === email);
  if (existing) {
    const { error } = await sb.auth.admin.updateUserById(existing.id, { password, app_metadata });
    if (error) throw error;
    return { email, password, updated: true };
  }
  const { error } = await sb.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata,
  });
  if (error) throw error;
  return { email, password, updated: false };
}

async function main() {
  const credentials = [];

  const natPass = genPassword();
  const nat = await upsertUser(emailFor('nat'), natPass, { role: 'national' });
  credentials.push({ identifiant: 'dgct.national', ...nat });
  console.log(`national account ${nat.updated ? 'updated' : 'created'}: ${nat.email}`);

  for (const v of villes) {
    const pass = genPassword();
    const res = await upsertUser(emailFor('city', v), pass, { role: 'commune', commune: v });
    credentials.push({ identifiant: v.toLowerCase().replace(/\s+/g, '-') + '.commune', ...res });
    console.log(`commune account ${res.updated ? 'updated' : 'created'}: ${res.email}`);

    const cityData = JSON.parse(fs.readFileSync(path.join(CITIES_DIR, v + '.json'), 'utf8'));
    const { error } = await sb.from('city_data').upsert({ city: v, ...cityData });
    if (error) throw error;
    console.log(`city_data upserted for ${v}`);
  }

  const outPath = path.join(__dirname, '..', 'credentials.local.json');
  fs.writeFileSync(outPath, JSON.stringify(credentials, null, 2));
  console.log(`\nCredentials written to ${outPath} (gitignored — save them somewhere safe, then delete the file).`);
}

main().catch(e => { console.error(e); process.exit(1); });
