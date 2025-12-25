#!/usr/bin/env node

/**
 * Auto-run Migration Script
 * Automatically runs a specific migration file or all pending migrations
 * Usage: node scripts/auto-run-migration.js [migration-file-name]
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
  console.error('❌ ERROR: DATABASE_URL not found in .env.local');
  console.error('   Please set DATABASE_URL in .env.local');
  console.error('   You can find it in Supabase Dashboard → Settings → Database → Connection string');
  process.exit(1);
}

// Parse DATABASE_URL
const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.error('❌ ERROR: Invalid DATABASE_URL format.');
  console.error('   Expected format: postgresql://user:password@host:port/database');
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

async function runMigration(migrationFileName) {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const migrationsDir = path.join(root, 'supabase', 'migrations');
    
    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    if (migrationFileName) {
      // Run specific migration
      const migrationPath = path.join(migrationsDir, migrationFileName);
      
      if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Migration file not found: ${migrationFileName}`);
        await client.end();
        process.exit(1);
      }

      // Check if already applied
      const { rows } = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [migrationFileName]
      );

      if (rows.length > 0) {
        console.log(`⏭️  Migration ${migrationFileName} already applied`);
        await client.end();
        process.exit(0);
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      if (!migrationSQL.trim()) {
        console.log(`⚠️  Migration file is empty: ${migrationFileName}`);
        await client.end();
        process.exit(0);
      }

      console.log(`📄 Running migration: ${migrationFileName}...\n`);
      
      try {
        // Don't use transaction for migrations that modify types/enums
        // Some operations like CREATE TYPE cannot be rolled back
        await client.query(migrationSQL);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [migrationFileName]
        );
        console.log(`✅ Migration ${migrationFileName} applied successfully!\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${migrationFileName} failed:`);
        console.error(`   ${error.message}`);
        if (error.code) {
          console.error(`   Error code: ${error.code}`);
        }
        if (error.detail) {
          console.error(`   Detail: ${error.detail}`);
        }
        if (error.hint) {
          console.error(`   Hint: ${error.hint}`);
        }
        await client.end();
        process.exit(1);
      }
    } else {
      // Run all pending migrations
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      const { rows: appliedMigrations } = await client.query(
        'SELECT version FROM schema_migrations ORDER BY version'
      );
      const appliedVersions = new Set(appliedMigrations.map(r => r.version));

      let appliedCount = 0;
      let skippedCount = 0;

      for (const file of migrationFiles) {
        if (appliedVersions.has(file)) {
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
          await client.query('BEGIN');
          await client.query(migrationSQL);
          await client.query(
            'INSERT INTO schema_migrations (version) VALUES ($1)',
            [file]
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
      console.log(`   Total: ${migrationFiles.length}\n`);
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

// Get migration file name from command line argument
const migrationFileName = process.argv[2];
runMigration(migrationFileName);

