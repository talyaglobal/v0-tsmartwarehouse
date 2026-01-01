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
  const dbPassword = env.SUPABASE_DB_PASSWORD || env.POSTGRES_PASSWORD;
  if (!dbPassword) {
    console.error('ERROR: DATABASE_URL or SUPABASE_DB_PASSWORD not found in .env');
    process.exit(1);
  }
  dbUrl = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
}

async function pushMigration() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase database');

    const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '103_add_metadata_to_bookings.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('📄 Reading migration file: 103_add_metadata_to_bookings.sql');
    console.log('🚀 Executing migration...');

    await client.query(sql);

    console.log('✅ Migration 103 completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

pushMigration();
