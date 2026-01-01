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
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// We'll use the direct connection string if DATABASE_URL is available
let dbUrl = env.DATABASE_URL;

// If DATABASE_URL is not available, try to construct it
if (!dbUrl) {
  // Try to get password from environment or use service role key
  const dbPassword = env.SUPABASE_DB_PASSWORD || env.DATABASE_PASSWORD;
  if (dbPassword) {
    // Default to East US (Ohio) pooler
    dbUrl = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
  } else {
    console.error('ERROR: DATABASE_URL or SUPABASE_DB_PASSWORD not found.');
    console.error('Please set DATABASE_URL in .env file or provide SUPABASE_DB_PASSWORD');
    console.error('You can find the database password in Supabase Dashboard -> Settings -> Database');
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

async function runMigrations() {
  try {
    console.log('🔌 Connecting to Supabase database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

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
      console.log(`📄 Running migration: ${migration.name} (${migration.file})...`);

      try {
        await client.query(migrationSQL);
        console.log(`✅ Migration ${migration.file} applied successfully!\n`);
      } catch (error) {
        // Check if error is because table/policy already exists
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.code === '42P07' || // duplicate_table
            error.code === '42710') { // duplicate_object
          console.log(`ℹ️  Migration ${migration.file} already applied (or objects exist), skipping...\n`);
        } else {
          console.error(`❌ Error in migration ${migration.file}:`);
          console.error(`   ${error.message}`);
          if (error.detail) {
            console.error(`   Detail: ${error.detail}`);
          }
          if (error.position) {
            console.error(`   Position: ${error.position}`);
          }
          throw error;
        }
      }
    }

    console.log('✅ All migrations completed successfully!');
    console.log('   Company services feature is now ready to use.');

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

