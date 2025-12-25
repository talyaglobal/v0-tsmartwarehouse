#!/usr/bin/env node

/**
 * Run migration step by step to identify the exact failing step
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

async function runStepByStep() {
  try {
    await client.connect();
    console.log('✅ Connected\n');

    const migrationPath = path.join(root, 'supabase', 'migrations', '042_create_company_role_enum.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolons and execute step by step
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} statements\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');
      console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);
      
      try {
        await client.query(stmt);
        console.log(`✅ Step ${i + 1} completed\n`);
      } catch (error) {
        console.error(`❌ Step ${i + 1} failed: ${error.message}`);
        console.error(`Statement: ${stmt.substring(0, 200)}...\n`);
        throw error;
      }
    }
    
    await client.end();
    console.log('✅ Migration completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    await client.end();
    process.exit(1);
  }
}

runStepByStep();

