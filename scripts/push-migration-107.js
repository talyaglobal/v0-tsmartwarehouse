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

// Try to get DATABASE_URL from env or construct from Supabase env vars
let dbUrl = env.DATABASE_URL;

// If DATABASE_URL is not set, try to construct it from Supabase URL
if (!dbUrl && env.NEXT_PUBLIC_SUPABASE_URL) {
  // Extract project ref from Supabase URL
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
  
  if (projectRef) {
    // Try to get password from service role key or construct connection string
    // For Supabase, we need the direct database connection string
    console.log('Note: DATABASE_URL not found. Please set DATABASE_URL in .env.local');
    console.log('Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres');
    process.exit(1);
  }
}

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in .env or environment.');
  console.error('Please set DATABASE_URL in .env.local');
  process.exit(1);
}

// Parse DATABASE_URL - handle both standard and Supabase pooler format
let host, port, user, password, database;
try {
  const url = new URL(dbUrl);
  host = url.hostname;
  port = url.port || '5432';
  user = url.username;
  password = url.password;
  database = url.pathname.slice(1) || 'postgres';
} catch (e) {
  // Try regex parsing for pooler format
  const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!urlMatch) {
    console.error('ERROR: Invalid DATABASE_URL format.');
    process.exit(1);
  }
  [, user, password, host, port, database] = urlMatch;
}

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

async function pushMigration107() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Check if migration 107 is already applied
    const checkResult = await client.query(
      "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '107'"
    );
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Migration 107 is already applied.');
      await client.end();
      process.exit(0);
    }

    // Read migration file
    const migrationPath = path.join(root, 'supabase', 'migrations', '107_postgis_and_marketplace_tables.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error('ERROR: Migration file not found:', migrationPath);
      await client.end();
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration 107...');
    
    // Run migration in a transaction
    await client.query('BEGIN');
    try {
      await client.query(migrationSQL);
      
      // Record migration in schema_migrations
      await client.query(
        "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('107', '107_postgis_and_marketplace_tables.sql') ON CONFLICT (version) DO NOTHING"
      );
      
      await client.query('COMMIT');
      console.log('✅ Migration 107 applied successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    await client.end();
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
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

pushMigration107();

