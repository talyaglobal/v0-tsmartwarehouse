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
  console.error('ERROR: DATABASE_URL not found in .env or environment.');
  console.error('Please set DATABASE_URL in .env.local');
  console.error('You can find it in Supabase Dashboard → Settings → Database → Connection string');
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

async function checkTableExists() {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'warehouse_services'
      );
    `);
    return result.rows[0].exists;
  } catch (error) {
    console.error('Error checking table:', error.message);
    return false;
  }
}

async function applyMigration() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    // Check if table already exists
    const tableExists = await checkTableExists();
    if (tableExists) {
      console.log('✅ warehouse_services table already exists. Migration may have already been applied.');
      console.log('   Skipping migration...');
      await client.end();
      process.exit(0);
    }

    const migrationPath = path.join(root, 'supabase', 'migrations', '053_create_services_and_orders.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`ERROR: Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    if (!migrationSQL.trim()) {
      console.error('ERROR: Migration file is empty');
      process.exit(1);
    }

    console.log('\n📄 Applying migration: 053_create_services_and_orders.sql...');
    
    try {
      // Run migration in a transaction
      await client.query('BEGIN');
      await client.query(migrationSQL);
      await client.query('COMMIT');
      console.log('✅ Migration applied successfully!');
      console.log('   Created tables: warehouse_services, service_orders, service_order_items');
      console.log('   Added RLS policies and seed data');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Migration failed:`, error.message);
      if (error.code) {
        console.error('   Error code:', error.code);
      }
      if (error.detail) {
        console.error('   Detail:', error.detail);
      }
      if (error.hint) {
        console.error('   Hint:', error.hint);
      }
      throw error;
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration process failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

applyMigration();

