/**
 * Check and push migrations 116-119
 * First checks if migration 116 is applied, then pushes 117-119
 */

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

async function checkTableExists(tableName) {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists;
}

async function pushMigration(version, filename) {
  // Check if already applied
  const checkResult = await client.query(
    "SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1",
    [version]
  );
  
  if (checkResult.rows.length > 0) {
    console.log(`⏭️  Migration ${version} already applied, skipping...`);
    return { applied: false, skipped: true };
  }

  // Read migration file
  const migrationPath = path.join(root, 'supabase', 'migrations', filename);
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    return { applied: false, error: 'File not found' };
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  if (!migrationSQL.trim()) {
    console.log(`⚠️  Skipping ${filename} (empty file)`);
    return { applied: false, skipped: true };
  }

  console.log(`📦 Applying migration ${version}: ${filename}...`);
  
  try {
    await client.query('BEGIN');
    await client.query(migrationSQL);
    
    await client.query(
      "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
      [version, filename]
    );
    
    await client.query('COMMIT');
    console.log(`✅ Migration ${version} applied successfully!\n`);
    return { applied: true, skipped: false };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration ${version} failed:`, error.message);
    if (error.code) console.error('   Error code:', error.code);
    if (error.detail) console.error('   Detail:', error.detail);
    if (error.hint) console.error('   Hint:', error.hint);
    return { applied: false, error: error.message };
  }
}

async function main() {
  try {
    console.log('🚀 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Ensure schema_migrations table exists
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Check if crm_contacts table exists (from migration 116)
    const crmContactsExists = await checkTableExists('crm_contacts');
    
    if (!crmContactsExists) {
      console.log('⚠️  crm_contacts table not found. Checking if migration 116 needs to be applied...\n');
      
      // Try to apply migration 116 first
      const migration116 = await pushMigration('116', '116_add_warehouse_finder_reseller_roles.sql');
      
      if (!migration116.applied && !migration116.skipped) {
        console.error('❌ Migration 116 failed. Cannot proceed with migrations 117-119.');
        console.error('   Please apply migration 116 first.');
        await client.end();
        process.exit(1);
      }
    } else {
      console.log('✅ crm_contacts table exists (migration 116 already applied)\n');
    }

    // Now apply migrations 117-119
    const migrations = [
      { version: '117', filename: '117_extend_crm_contacts_for_signatures.sql' },
      { version: '118', filename: '118_add_signature_requests.sql' },
      { version: '119', filename: '119_add_agreement_tracking.sql' },
    ];

    let appliedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const migration of migrations) {
      const result = await pushMigration(migration.version, migration.filename);
      if (result.applied) appliedCount++;
      else if (result.skipped) skippedCount++;
      else failedCount++;
    }

    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Applied: ${appliedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`📦 Total: ${migrations.length}`);
    console.log('='.repeat(50));

    if (failedCount === 0) {
      console.log('\n🎉 All migrations completed successfully!');
    } else {
      console.log('\n⚠️  Some migrations failed. Please check the errors above.');
    }

    await client.end();
    process.exit(failedCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Migration process failed:', error.message);
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

main();

