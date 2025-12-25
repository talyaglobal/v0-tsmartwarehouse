#!/usr/bin/env node

/**
 * Check current RLS policies
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

async function checkPolicies() {
  try {
    await client.connect();
    
    console.log('📊 Checking RLS policies on company_members...\n');
    
    const policies = await client.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies 
      WHERE tablename IN ('company_members', 'company_invitations')
      ORDER BY tablename, policyname
    `);
    
    if (policies.rows.length > 0) {
      policies.rows.forEach(policy => {
        console.log(`Table: ${policy.tablename}`);
        console.log(`  Policy: ${policy.policyname}`);
        console.log(`  Command: ${policy.cmd}`);
        if (policy.qual) {
          console.log(`  USING: ${policy.qual.substring(0, 100)}...`);
        }
        console.log('');
      });
    } else {
      console.log('No policies found');
    }
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

checkPolicies();

