#!/usr/bin/env node

/**
 * Check Different Supabase Connection Formats
 * Tests various connection string formats to find the correct one
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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;

if (!dbUrl) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

// Parse current DATABASE_URL
const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.error('❌ Invalid DATABASE_URL format');
  process.exit(1);
}

const [, user, password, currentHost, port, database] = urlMatch;
const projectRef = 'gyodzimmhtecocscyeip';

console.log('🔍 Testing Different Connection Formats...\n');
console.log('Current DATABASE_URL:');
console.log(`   ${dbUrl.substring(0, 50)}...\n`);

// Try different hostname formats
const hostFormats = [
  {
    name: 'Current Format (db.xxx.supabase.co)',
    host: `db.${projectRef}.supabase.co`,
  },
  {
    name: 'Alternative Format 1 (xxx.supabase.co)',
    host: `${projectRef}.supabase.co`,
  },
  {
    name: 'Alternative Format 2 (pooler)',
    host: `aws-0-us-east-1.pooler.supabase.com`,
    user: `postgres.${projectRef}`,
  },
];

async function testConnection(format) {
  const client = new Client({
    host: format.host,
    port: parseInt(port),
    user: format.user || user,
    password: password,
    database: database,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    await client.end();
    return { success: true, version: result.rows[0].version };
  } catch (error) {
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    return { success: false, error: error.message, code: error.code };
  }
}

async function testAllFormats() {
  for (const format of hostFormats) {
    console.log(`🧪 Testing: ${format.name}`);
    console.log(`   Host: ${format.host}`);
    const result = await testConnection(format);
    
    if (result.success) {
      console.log(`   ✅ SUCCESS! This format works!\n`);
      console.log(`📋 Use this DATABASE_URL:`);
      const workingUrl = `postgresql://${format.user || user}:${password}@${format.host}:${port}/${database}`;
      console.log(`   ${workingUrl}\n`);
      console.log(`💡 To update, run:`);
      console.log(`   node scripts/update-database-url.js "${workingUrl}"\n`);
      return true;
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      if (result.code) {
        console.log(`   Code: ${result.code}\n`);
      } else {
        console.log('');
      }
    }
  }
  
  console.log('❌ None of the tested formats worked.\n');
  console.log('💡 Please check:');
  console.log('   1. Go to Supabase Dashboard → Settings → Database');
  console.log('   2. Copy the exact "Connection string" or "URI"');
  console.log('   3. Make sure your Supabase project is active (not paused)');
  console.log('   4. Check your internet connection\n');
  return false;
}

testAllFormats().then(success => {
  process.exit(success ? 0 : 1);
});

