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

// Try to get DATABASE_URL from env, or construct from Supabase URL
let dbUrl = env.DATABASE_URL;

if (!dbUrl) {
  // Try to construct from Supabase URL
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      const projectRef = match[1];
      // Try to get password from service role key or construct connection string
      console.log('⚠️  DATABASE_URL not found. Please provide DATABASE_URL in .env.local');
      console.log('   Format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres');
      console.log(`   Or get it from: https://app.supabase.com/project/${projectRef}/settings/database`);
      process.exit(1);
    }
  }
  console.error('ERROR: DATABASE_URL not found in .env or environment.');
  process.exit(1);
}

// Parse DATABASE_URL
const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.error('ERROR: Invalid DATABASE_URL format.');
  console.error('Expected format: postgresql://user:password@host:port/database');
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

async function runMigration() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    const migrationPath = path.join(root, 'supabase', 'migrations', '092_update_booking_ids_to_short_format.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Migration file loaded');
    console.log('🚀 Running migration 092: Update booking IDs to short format...');
    console.log('   This will:');
    console.log('   1. Convert bookings.id from UUID to TEXT');
    console.log('   2. Update all existing booking IDs to short format');
    console.log('   3. Update all foreign key references');
    console.log('');

    await client.query(migrationSQL);
    console.log('');
    console.log('✅ Migration 092 applied successfully!');
    console.log('   All booking IDs have been updated to short format.');
    console.log('   Format: {CITY_CODE}-{DATE_CODE}-{TYPE}-{RANDOM}');
    console.log('   Example: NY-315-ARE-A3B7');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    if (error.position) {
      console.error('   Position:', error.position);
    }
    await client.end();
    process.exit(1);
  }
}

runMigration();

