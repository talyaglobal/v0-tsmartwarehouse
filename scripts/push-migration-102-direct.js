const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse .env file
function parseDotEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envPath2 = path.join(__dirname, '..', '.env');
  const envPathToUse = fs.existsSync(envPath) ? envPath : envPath2;
  
  if (!fs.existsSync(envPathToUse)) {
    return {};
  }
  const content = fs.readFileSync(envPathToUse, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
  return env;
}

const root = path.join(__dirname, '..');
const env = { ...process.env, ...parseDotEnv() };

// Get Supabase connection details
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL not found in .env');
  process.exit(1);
}

// Extract project ref from URL
const projectRefMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!projectRefMatch) {
  console.error('ERROR: Could not extract project ref from Supabase URL');
  process.exit(1);
}
const projectRef = projectRefMatch[1];

// Construct connection string
let dbUrl = env.DATABASE_URL;

// If DATABASE_URL is not available, try to construct it
if (!dbUrl) {
  const dbPassword = env.SUPABASE_DB_PASSWORD || env.DATABASE_PASSWORD;
  if (dbPassword) {
    dbUrl = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
  } else {
    console.error('ERROR: DATABASE_URL or SUPABASE_DB_PASSWORD not found.');
    console.error('Please set DATABASE_URL in .env file or provide SUPABASE_DB_PASSWORD');
    process.exit(1);
  }
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
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔌 Connecting to Supabase database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const migrationPath = path.join(root, 'supabase', 'migrations', '102_remove_need_transportation.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`ERROR: Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Running migration: Remove need_transportation (102_remove_need_transportation.sql)...\n');

    await client.query(migrationSQL);
    console.log('✅ Migration 102 applied successfully!');
    console.log('   Removed need_transportation column.');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
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

