const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse .env file
function parseDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const content = fs.readFileSync(envPath, 'utf8');
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

// Get migration file from command line argument
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('ERROR: Please provide migration file name as argument');
  console.error('Usage: node scripts/push-single-migration.js 093_create_company_services.sql');
  process.exit(1);
}

// Try to get DATABASE_URL from env
let dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in .env or environment.');
  console.error('Please set DATABASE_URL in .env file');
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
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    const migrationPath = path.join(root, 'supabase', 'migrations', migrationFile);
    if (!fs.existsSync(migrationPath)) {
      console.error(`ERROR: Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`📄 Running migration: ${migrationFile}...\n`);

    await client.query(migrationSQL);
    console.log(`✅ Migration ${migrationFile} applied successfully!`);

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Migration failed: ${error.message}`);
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

