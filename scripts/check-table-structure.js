#!/usr/bin/env node

/**
 * Check current table structure
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

async function checkStructure() {
  try {
    await client.connect();
    
    console.log('📊 Checking company_members table structure...\n');
    
    // Check column types
    const result = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        udt_name,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'company_members' 
      AND column_name IN ('role', 'status')
      ORDER BY column_name
    `);
    
    console.log('Column Types:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.udt_name})`);
      if (row.column_default) {
        console.log(`    Default: ${row.column_default}`);
      }
    });
    
    // Check if enum types exist
    const enumCheck = await client.query(`
      SELECT typname FROM pg_type 
      WHERE typname IN ('role', 'status')
    `);
    
    console.log('\nEnum Types:');
    if (enumCheck.rows.length > 0) {
      enumCheck.rows.forEach(row => {
        console.log(`  ✅ ${row.typname} enum exists`);
      });
    } else {
      console.log('  ❌ No enum types found');
    }
    
    // Check sample data
    const sampleData = await client.query(`
      SELECT role, status 
      FROM company_members 
      LIMIT 5
    `);
    
    if (sampleData.rows.length > 0) {
      console.log('\nSample Data:');
      sampleData.rows.forEach(row => {
        console.log(`  role: ${row.role} (${typeof row.role}), status: ${row.status} (${typeof row.status})`);
      });
    } else {
      console.log('\nNo data in company_members table');
    }
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

checkStructure();

