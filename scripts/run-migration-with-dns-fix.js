#!/usr/bin/env node

/**
 * Run Migration with DNS Fix
 * Forces IPv4 resolution and handles DNS issues
 */

const { Client } = require('pg');
const dns = require('dns');
const fs = require('fs');
const path = require('path');

// Force IPv4
dns.setDefaultResultOrder('ipv4first');

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
  process.exit(1);
}

// Parse DATABASE_URL
const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.error('❌ ERROR: Invalid DATABASE_URL format.');
  process.exit(1);
}

const [, user, password, host, port, database] = urlMatch;

console.log('🔧 Using DNS fix (IPv4 first)...\n');
console.log(`Host: ${host}`);
console.log(`Port: ${port}\n`);

// Resolve hostname to IP first
async function resolveAndConnect() {
  try {
    console.log('🌐 Resolving hostname...');
    const addresses = await new Promise((resolve, reject) => {
      dns.lookup(host, { family: 4, all: true }, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });

    if (!addresses || addresses.length === 0) {
      // Try IPv6
      console.log('   IPv4 not found, trying IPv6...');
      const addresses6 = await new Promise((resolve, reject) => {
        dns.lookup(host, { family: 6, all: true }, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      });
      
      if (!addresses6 || addresses6.length === 0) {
        throw new Error('Could not resolve hostname to any IP address');
      }
      
      console.log(`   ✅ Resolved to IPv6: ${addresses6[0].address}`);
      return addresses6[0].address;
    }

    console.log(`   ✅ Resolved to IPv4: ${addresses[0].address}`);
    return addresses[0].address;
  } catch (error) {
    console.log(`   ⚠️  DNS resolution failed: ${error.message}`);
    console.log('   Trying direct connection with hostname...\n');
    return host; // Fallback to hostname
  }
}

async function runMigrations() {
  try {
    const ipAddress = await resolveAndConnect();
    
    const client = new Client({
      host: ipAddress,
      port: parseInt(port),
      user: user,
      password: password,
      database: database,
      ssl: {
        rejectUnauthorized: false
      },
    });

    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const migrationsDir = path.join(root, 'supabase', 'migrations');
    
    // Get all migration files and sort them
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files\n`);

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
        throw error;
      }
    }

    console.log(`\n✅ Migration summary:`);
    console.log(`   Applied: ${appliedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${migrationFiles.length}\n`);

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

