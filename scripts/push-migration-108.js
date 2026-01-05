const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function parseDotEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach((line) => {
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

const root = path.resolve(__dirname, '..');
const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')];
const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0];
const env = Object.assign({}, process.env, parseDotEnv(envPath));

// Get Supabase connection details from environment
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL not found in .env.local or environment.');
  process.exit(1);
}

// Extract database connection details from Supabase URL
// Supabase URL format: https://project-ref.supabase.co
// We need to construct the direct database connection string
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

// Try to get DATABASE_URL directly
let dbUrl = env.DATABASE_URL;

// If DATABASE_URL is not set, try to construct it from Supabase URL
if (!dbUrl) {
  const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (projectRef) {
    // Try to get password from SUPABASE_DB_PASSWORD or use service role key as fallback
    const dbPassword = env.SUPABASE_DB_PASSWORD || supabaseServiceKey?.substring(0, 20);
    if (dbPassword) {
      // Construct connection string (this is a simplified version)
      // In production, you should use the actual database password
      console.warn('WARNING: DATABASE_URL not found. Attempting to use Supabase connection...');
      console.warn('Please set DATABASE_URL in .env.local for direct database connection.');
      console.warn('You can find it in Supabase Dashboard > Settings > Database > Connection string');
      process.exit(1);
    }
  }
  console.error('ERROR: DATABASE_URL not found in .env.local or environment.');
  console.error('Please set DATABASE_URL in .env.local');
  console.error('You can find it in Supabase Dashboard > Settings > Database > Connection string');
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
    console.log('Connecting to Supabase database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    const migrationPath = path.join(root, 'supabase', 'migrations', '108_fix_warehouse_photos_rls.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`ERROR: Migration file not found: ${migrationPath}`);
      await client.end();
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration 108_fix_warehouse_photos_rls.sql...');
    await client.query(migrationSQL);
    console.log('✅ Migration 108 applied successfully!');

    await client.end();
    console.log('✅ Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    if (error.position) {
      console.error('Position:', error.position);
    }
    await client.end();
    process.exit(1);
  }
}

runMigration();

