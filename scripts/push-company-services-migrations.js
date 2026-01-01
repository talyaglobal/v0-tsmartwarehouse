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

// Try to get DATABASE_URL from env or construct from Supabase env vars
let dbUrl = env.DATABASE_URL;
if (!dbUrl && env.NEXT_PUBLIC_SUPABASE_URL) {
  // Construct DATABASE_URL from Supabase connection string format
  // Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (projectRef && env.SUPABASE_DB_PASSWORD) {
    dbUrl = `postgresql://postgres.${projectRef}:${env.SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
  }
}

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in .env or environment.');
  console.error('Please set DATABASE_URL or SUPABASE_DB_PASSWORD in .env file');
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

async function runMigrations() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    const migrations = [
      { file: '093_create_company_services.sql', name: 'Create company_services table' },
      { file: '094_add_company_service_id_to_warehouse_services.sql', name: 'Add company_service_id to warehouse_services' },
      { file: '095_update_company_services_rls_for_owners.sql', name: 'Update RLS policies for company_owner role' }
    ];

    for (const migration of migrations) {
      const migrationPath = path.join(root, 'supabase', 'migrations', migration.file);
      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Migration file not found: ${migration.file}, skipping...`);
        continue;
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      console.log(`\n📄 Running migration: ${migration.name} (${migration.file})...`);

      try {
        await client.query(migrationSQL);
        console.log(`✅ Migration ${migration.file} applied successfully!`);
      } catch (error) {
        // Check if error is because table/policy already exists
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`ℹ️  Migration ${migration.file} already applied (or objects exist), skipping...`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ All migrations completed successfully!');
    console.log('   Company services table and policies are now ready.');

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

runMigrations();

