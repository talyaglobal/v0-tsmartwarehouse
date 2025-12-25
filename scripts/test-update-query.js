#!/usr/bin/env node

/**
 * Test UPDATE query directly
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

async function testUpdate() {
  try {
    await client.connect();
    console.log('✅ Connected\n');
    
    // Disable RLS
    console.log('Disabling RLS...');
    await client.query('ALTER TABLE company_members DISABLE ROW LEVEL SECURITY');
    await client.query('ALTER TABLE company_invitations DISABLE ROW LEVEL SECURITY');
    console.log('✅ RLS disabled\n');
    
    // Drop policies
    console.log('Dropping policies...');
    await client.query('DROP POLICY IF EXISTS "Users can view own memberships" ON company_members');
    await client.query('DROP POLICY IF EXISTS "Company admins can view members" ON company_members');
    await client.query('DROP POLICY IF EXISTS "Company admins can manage members" ON company_members');
    console.log('✅ Policies dropped\n');
    
    // Test UPDATE
    console.log('Testing UPDATE query...');
    const result = await client.query(`
      UPDATE company_members 
      SET role = 'member' 
      WHERE role NOT IN ('owner', 'admin', 'member')
    `);
    console.log(`✅ UPDATE successful: ${result.rowCount} rows affected\n`);
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('Code:', error.code);
    }
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    await client.end();
    process.exit(1);
  }
}

testUpdate();

