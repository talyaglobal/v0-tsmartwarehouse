const { Client } = require('pg');
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

const root = path.resolve(__dirname, '..');
const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')];
const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0];
const env = Object.assign({}, process.env, parseDotEnv(envPath));

let dbUrl = env.DATABASE_URL;

if (!dbUrl) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  if (supabaseUrl) {
    const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      const projectRef = match[1];
      const dbPassword = env.SUPABASE_DB_PASSWORD || env.POSTGRES_PASSWORD;
      if (dbPassword) {
        dbUrl = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
      }
    }
  }
}

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found.');
  process.exit(1);
}

const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.error('ERROR: Invalid DATABASE_URL format.');
  process.exit(1);
}

const [, user, password, host, port, database] = urlMatch;

const client = new Client({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  ssl: {
    rejectUnauthorized: false
  }
});

async function recordMigration() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Check if migration is already recorded
    const checkResult = await client.query(
      'SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1',
      ['104']
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ Migration 104 is already recorded in schema_migrations');
      await client.end();
      process.exit(0);
    }

    // Record migration
    await client.query(
      'INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING',
      ['104', '104_add_time_slot_fields_to_bookings', []]
    );

    console.log('✅ Migration 104 recorded in schema_migrations');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to record migration:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    await client.end();
    process.exit(1);
  }
}

recordMigration();

