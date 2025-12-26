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
const dbUrl = env.DATABASE_URL;

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in .env or environment.');
  process.exit(1);
}

// Parse DATABASE_URL
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

async function checkMigrationApplied(migrationName) {
  try {
    // Check if schema_migrations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      return false;
    }

    const result = await client.query(
      'SELECT * FROM schema_migrations WHERE version = $1',
      [migrationName]
    );
    return result.rows.length > 0;
  } catch (error) {
    // If table doesn't exist, migration not applied
    return false;
  }
}

async function recordMigration(migrationName) {
  try {
    // Create schema_migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Record migration
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
      [migrationName]
    );
  } catch (error) {
    console.warn('Warning: Could not record migration:', error.message);
  }
}

async function runMigration(migrationFile, migrationName) {
  try {
    console.log(`\n📋 Applying migration: ${migrationName}...`);
    
    // Check if already applied
    const alreadyApplied = await checkMigrationApplied(migrationName);
    if (alreadyApplied) {
      console.log(`⏭️  Migration ${migrationName} already applied, skipping...`);
      return true;
    }

    const migrationPath = path.join(root, 'supabase', 'migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      return false;
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log(`   Running SQL from ${migrationFile}...`);
    await client.query('BEGIN');
    
    try {
      await client.query(migrationSQL);
      await recordMigration(migrationName);
      await client.query('COMMIT');
      console.log(`✅ Migration ${migrationName} applied successfully!`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error(`❌ Migration ${migrationName} failed:`, error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    if (error.position) {
      console.error('   Position:', error.position);
    }
    return false;
  }
}

async function runMigrations() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    const migrations = [
      { file: '063_update_role_system.sql', name: '063_update_role_system' },
      { file: '064_update_rls_policies_for_roles.sql', name: '064_update_rls_policies_for_roles' }
    ];

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const migration of migrations) {
      const result = await runMigration(migration.file, migration.name);
      if (result === true) {
        const alreadyApplied = await checkMigrationApplied(migration.name);
        if (alreadyApplied && !migration.file.includes('064')) {
          skippedCount++;
        } else {
          successCount++;
        }
      } else {
        failedCount++;
        console.error(`\n❌ Stopping migration process due to failure.`);
        break;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Applied: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);

    if (failedCount > 0) {
      await client.end();
      process.exit(1);
    }

    await client.end();
    console.log('\n✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    await client.end();
    process.exit(1);
  }
}

runMigrations();

