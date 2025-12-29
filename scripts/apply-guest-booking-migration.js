const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function parseDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const obj = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    let val = trimmed.slice(idx + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    obj[key] = val;
  }
  return obj;
}

async function applyMigration() {
  const root = process.cwd();
  const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')];
  const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0];
  const env = Object.assign({}, process.env, parseDotEnv(envPath));
  const dbUrl = env.DATABASE_URL;

  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not found in .env or environment.');
    process.exit(1);
  }

  console.log('Loaded env from:', envPath);
  console.log('Using DATABASE_URL:', dbUrl.replace(/(:).*@(.*)/, ':*****@$2'));

  const pool = new Pool({ connectionString: dbUrl });

  try {
    const migrationFile = path.join(root, 'supabase', 'migrations', '084_make_customer_id_nullable_for_guest_bookings.sql');
    const migrationSql = fs.readFileSync(migrationFile, 'utf8');

    console.log('\nApplying migration: 084_make_customer_id_nullable_for_guest_bookings.sql');

    const client = await pool.connect();
    try {
      await client.query(migrationSql);
      console.log('✓ Migration applied successfully!');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
