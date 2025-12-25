#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Tests if DATABASE_URL is correct and can connect to Supabase
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

if (!dbUrl) {
  console.error('❌ ERROR: DATABASE_URL not found in .env.local');
  console.error('   Please set DATABASE_URL in .env.local');
  process.exit(1);
}

console.log('🔍 Testing DATABASE_URL connection...\n');
console.log('📋 Connection String:');
console.log(`   ${dbUrl.substring(0, 30)}...${dbUrl.substring(dbUrl.length - 20)}\n`);

// Parse DATABASE_URL
const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.error('❌ ERROR: Invalid DATABASE_URL format.');
  console.error('   Expected format: postgresql://user:password@host:port/database');
  console.error('\n💡 Fix:');
  console.error('   1. Go to Supabase Dashboard → Settings → Database');
  console.error('   2. Copy the "Connection string" or "URI"');
  console.error('   3. Update .env.local with: DATABASE_URL=<copied-string>');
  process.exit(1);
}

const [, user, password, host, port, database] = urlMatch;

console.log('📋 Parsed Connection Details:');
console.log(`   User: ${user}`);
console.log(`   Host: ${host}`);
console.log(`   Port: ${port}`);
console.log(`   Database: ${database}\n`);

const client = new Client({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000, // 10 second timeout
});

async function testConnection() {
  try {
    console.log('🔌 Attempting to connect...');
    await client.connect();
    console.log('✅ Connection successful!\n');
    
    // Test a simple query
    console.log('🧪 Testing database query...');
    const result = await client.query('SELECT version()');
    console.log('✅ Database query successful!');
    console.log(`   PostgreSQL version: ${result.rows[0].version.substring(0, 50)}...\n`);
    
    // Check if schema_migrations table exists
    const migrationCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      )
    `);
    
    if (migrationCheck.rows[0].exists) {
      const { rows } = await client.query('SELECT COUNT(*) as count FROM schema_migrations');
      console.log(`📊 Migration status: ${rows[0].count} migrations applied\n`);
    } else {
      console.log('📊 Migration status: No migrations table found (will be created on first migration)\n');
    }
    
    await client.end();
    console.log('✅ All tests passed! DATABASE_URL is correct.\n');
    console.log('🚀 You can now run migrations:');
    console.log('   npm run db:migrate');
    console.log('   or');
    console.log('   node scripts/auto-run-migration.js\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed!\n');
    console.error(`   Error: ${error.message}`);
    
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 DNS Resolution Error:');
      console.error('   The hostname could not be resolved.');
      console.error('   Possible causes:');
      console.error('   1. Wrong hostname in DATABASE_URL');
      console.error('   2. Network connectivity issue');
      console.error('   3. Supabase project might be paused or deleted');
      console.error('\n   Fix:');
      console.error('   1. Go to Supabase Dashboard → Settings → Database');
      console.error('   2. Copy the "Connection string" or "URI" again');
      console.error('   3. Make sure the hostname is correct');
      console.error('   4. Check if your Supabase project is active\n');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection Timeout:');
      console.error('   Could not connect to the database server.');
      console.error('   Possible causes:');
      console.error('   1. Firewall blocking the connection');
      console.error('   2. Wrong port number');
      console.error('   3. Database server is down');
      console.error('\n   Fix:');
      console.error('   1. Check your network connection');
      console.error('   2. Verify the port is 5432');
      console.error('   3. Check Supabase project status\n');
    } else if (error.code === '28P01') {
      console.error('\n💡 Authentication Failed:');
      console.error('   Wrong username or password.');
      console.error('\n   Fix:');
      console.error('   1. Go to Supabase Dashboard → Settings → Database');
      console.error('   2. Copy the "Connection string" again');
      console.error('   3. Make sure password is correct (check for special characters)\n');
    } else {
      console.error('\n💡 General Error:');
      console.error('   Please check:');
      console.error('   1. DATABASE_URL format is correct');
      console.error('   2. Supabase project is active');
      console.error('   3. Network connection is working\n');
    }
    
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

testConnection();

