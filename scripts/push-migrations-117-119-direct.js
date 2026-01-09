/**
 * Push Migrations 117, 118, 119 to Supabase using direct PostgreSQL connection
 * Based on push-migration-107.js pattern
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

async function pushMigrations() {
  try {
    console.log('🚀 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const migrations = [
      { version: '117', filename: '117_extend_crm_contacts_for_signatures.sql' },
      { version: '118', filename: '118_add_signature_requests.sql' },
      { version: '119', filename: '119_add_agreement_tracking.sql' },
    ];

    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const migration of migrations) {
      // Check if already applied
      const checkResult = await client.query(
        "SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1",
        [migration.version]
      );
      
      if (checkResult.rows.length > 0) {
        console.log(`⏭️  Migration ${migration.version} already applied, skipping...`);
        skippedCount++;
        continue;
      }

      // Read migration file
      const migrationPath = path.join(root, 'supabase', 'migrations', migration.filename);
      if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Migration file not found: ${migrationPath}`);
        continue;
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      if (!migrationSQL.trim()) {
        console.log(`⚠️  Skipping ${migration.filename} (empty file)`);
        continue;
      }

      console.log(`📦 Applying migration ${migration.version}: ${migration.filename}...`);
      
      try {
        // Run migration in a transaction
        await client.query('BEGIN');
        await client.query(migrationSQL);
        
        // Record migration in schema_migrations
        await client.query(
          "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
          [migration.version, migration.filename]
        );
        
        await client.query('COMMIT');
        console.log(`✅ Migration ${migration.version} applied successfully!\n`);
        appliedCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${migration.version} failed:`, error.message);
        if (error.code) {
          console.error('   Error code:', error.code);
        }
        if (error.detail) {
          console.error('   Detail:', error.detail);
        }
        if (error.hint) {
          console.error('   Hint:', error.hint);
        }
        if (error.position) {
          console.error('   Position:', error.position);
        }
        throw error;
      }
    }

    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Applied: ${appliedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`📦 Total: ${migrations.length}`);
    console.log('='.repeat(50));

    if (appliedCount > 0) {
      console.log('\n🎉 All migrations completed successfully!');
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

pushMigrations();

