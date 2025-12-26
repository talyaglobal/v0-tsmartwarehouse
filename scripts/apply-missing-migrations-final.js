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
  console.error('ERROR: DATABASE_URL not found');
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

// List of migrations that need to be applied
const missingMigrations = [
  '055_enhance_inventory_tracking.sql',
  '056_add_capacity_tracking.sql',
  '057_add_payment_remaining_function.sql',
  '058_add_stock_levels_tracking.sql',
  '059_add_pallet_label_fields.sql',
  '060_create_performance_tables.sql',
];

async function applyMigrations() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const migrationsDir = path.join(root, 'supabase', 'migrations');
    let appliedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const fileName of missingMigrations) {
      const migrationPath = path.join(migrationsDir, fileName);
      
      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Migration file not found: ${fileName}`);
        skippedCount++;
        continue;
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      if (!migrationSQL.trim()) {
        console.log(`⚠️  Skipping ${fileName} (empty file)`);
        skippedCount++;
        continue;
      }

      console.log(`\n📄 Running migration: ${fileName}...`);
      
      try {
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');
        console.log(`✅ Migration ${fileName} applied successfully!`);
        appliedCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        
        // Check if error is because object already exists (safe to ignore)
        const isAlreadyExistsError = 
          error.code === '42710' || // duplicate_object
          error.code === '42P07' || // duplicate_table
          error.code === '42723' || // duplicate_function
          error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('already has');

        if (isAlreadyExistsError) {
          console.log(`⚠️  Migration ${fileName} - some objects already exist (skipping): ${error.message.split('\n')[0]}`);
          skippedCount++;
        } else {
          console.error(`❌ Migration ${fileName} failed:`, error.message);
          if (error.code) {
            console.error('   Error code:', error.code);
          }
          if (error.detail) {
            console.error('   Detail:', error.detail);
          }
          errorCount++;
        }
      }
    }

    console.log(`\n\n📊 Migration Summary:`);
    console.log(`   ✅ Applied: ${appliedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    await client.end();
    process.exit(errorCount > 0 ? 1 : 0);
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

applyMigrations();

