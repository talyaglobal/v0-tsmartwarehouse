#!/usr/bin/env node

/**
 * Run migration directly without transaction
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

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Connected\n');

    const migrationPath = path.join(root, 'supabase', 'migrations', '042_create_company_role_enum.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running migration...\n');
    
    // Execute migration directly (no transaction for type changes)
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(`   ${error.message}`);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    if (error.position) {
      console.error(`   Position: ${error.position}`);
      // Show context around error
      const migrationSQL = fs.readFileSync(path.join(root, 'supabase', 'migrations', '042_create_company_role_enum.sql'), 'utf8');
      const lines = migrationSQL.split('\n');
      const errorLine = Math.floor(error.position / 80); // Approximate
      console.error(`   Context:`);
      for (let i = Math.max(0, errorLine - 2); i < Math.min(lines.length, errorLine + 3); i++) {
        console.error(`   ${i + 1}: ${lines[i]}`);
      }
    }
    await client.end();
    process.exit(1);
  }
}

runMigration();

