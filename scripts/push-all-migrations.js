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

// Try to get DATABASE_URL or construct from Supabase credentials
let dbUrl = env.DATABASE_URL;

if (!dbUrl) {
  // Try to construct from Supabase URL
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (supabaseUrl && serviceRoleKey) {
    // Extract project ref from Supabase URL
    const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (urlMatch) {
      const projectRef = urlMatch[1];
      // Construct connection string
      // Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
      console.log('⚠️  DATABASE_URL not found. Please set DATABASE_URL in .env.local');
      console.log('   Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres');
      console.log('   You can find this in Supabase Dashboard → Settings → Database → Connection string');
      process.exit(1);
    }
  }
  
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

async function runMigrations() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    const migrationsDir = path.join(root, 'supabase', 'migrations');
    
    // Get all migration files and sort them
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically to ensure order

    console.log(`\nFound ${migrationFiles.length} migration files\n`);

    // Check which migrations have already been run
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: appliedMigrations } = await client.query(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const appliedVersions = new Set(appliedMigrations.map(r => r.version));

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of migrationFiles) {
      const version = file;
      
      if (appliedVersions.has(version)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        skippedCount++;
        continue;
      }

      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      if (!migrationSQL.trim()) {
        console.log(`⚠️  Skipping ${file} (empty file)`);
        continue;
      }

      console.log(`\n📄 Running migration: ${file}...`);
      
      try {
        // Run migration in a transaction
        await client.query('BEGIN');
        await client.query(migrationSQL);
        
        // Record migration
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
          [version]
        );
        
        await client.query('COMMIT');
        console.log(`✅ Migration ${file} applied successfully!`);
        appliedCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${file} failed:`, error.message);
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
    }

    console.log(`\n✅ Migration summary:`);
    console.log(`   Applied: ${appliedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${migrationFiles.length}`);

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

runMigrations();

