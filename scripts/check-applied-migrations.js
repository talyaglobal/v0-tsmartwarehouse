#!/usr/bin/env node

/**
 * Check which migrations have been applied
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

const dbUrl = env.DATABASE_URL;
const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
const [, user, password, host, port, database] = urlMatch;

const client = new Client({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  ssl: { rejectUnauthorized: false }
});

async function checkMigrations() {
  try {
    await client.connect();
    
    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    const { rows: appliedMigrations } = await client.query(
      'SELECT version, applied_at FROM schema_migrations ORDER BY version'
    );
    
    const migrationsDir = path.join(root, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log('📊 Migration Status:\n');
    console.log(`Total migration files: ${migrationFiles.length}`);
    console.log(`Applied migrations: ${appliedMigrations.length}\n`);
    
    const appliedSet = new Set(appliedMigrations.map(r => r.version));
    
    console.log('✅ Applied migrations:');
    appliedMigrations.forEach(m => {
      console.log(`   ${m.version} (${m.applied_at})`);
    });
    
    console.log('\n⏳ Pending migrations:');
    let hasPending = false;
    migrationFiles.forEach(file => {
      if (!appliedSet.has(file)) {
        console.log(`   ${file}`);
        hasPending = true;
      }
    });
    
    if (!hasPending) {
      console.log('   (none - all migrations applied)');
    }
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

checkMigrations();

