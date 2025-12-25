#!/usr/bin/env node

/**
 * Test IPv4 Connection to Supabase
 * Some networks only support IPv4, but Supabase might return IPv6 addresses
 */

const { Client } = require('pg');
const dns = require('dns');
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
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.error('❌ Invalid DATABASE_URL format');
  process.exit(1);
}

const [, user, password, host, port, database] = urlMatch;

console.log('🔍 Testing Connection with IPv4/IPv6 Support...\n');
console.log(`Host: ${host}`);
console.log(`Port: ${port}\n`);

// Check DNS resolution
console.log('🌐 DNS Resolution:');
dns.lookup(host, { all: true }, (err, addresses) => {
  if (err) {
    console.error(`   ❌ DNS Error: ${err.message}\n`);
    return;
  }
  
  console.log(`   ✅ Found ${addresses.length} address(es):`);
  addresses.forEach((addr, i) => {
    const type = addr.family === 4 ? 'IPv4' : 'IPv6';
    console.log(`   ${i + 1}. ${addr.address} (${type})`);
  });
  console.log('');

  // Try connecting with IPv4 first
  const ipv4Address = addresses.find(a => a.family === 4);
  const ipv6Address = addresses.find(a => a.family === 6);

  if (ipv4Address) {
    console.log(`🧪 Testing IPv4 connection (${ipv4Address.address})...`);
    testDirectIP(ipv4Address.address, 'IPv4');
  } else if (ipv6Address) {
    console.log(`⚠️  Only IPv6 available. Your network might not support IPv6.`);
    console.log(`   This could be the issue!\n`);
    console.log(`💡 Solutions:`);
    console.log(`   1. Use Connection Pooling (Session mode) from Supabase Dashboard`);
    console.log(`   2. Check if your network supports IPv6`);
    console.log(`   3. Contact your network administrator\n`);
  }
});

function testDirectIP(ipAddress, type) {
  const client = new Client({
    host: ipAddress, // Use IP directly
    port: parseInt(port),
    user: user,
    password: password,
    database: database,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000,
  });

  client.connect()
    .then(() => {
      console.log(`   ✅ ${type} connection successful!\n`);
      return client.query('SELECT version()');
    })
    .then((result) => {
      console.log(`   ✅ Database query successful!`);
      console.log(`   PostgreSQL: ${result.rows[0].version.substring(0, 50)}...\n`);
      return client.end();
    })
    .then(() => {
      console.log(`✅ Direct IP connection works!`);
      console.log(`💡 You can try using the IP address directly, but it's better to:`);
      console.log(`   1. Use Connection Pooling from Supabase Dashboard`);
      console.log(`   2. Check your network's IPv6 support\n`);
      process.exit(0);
    })
    .catch((error) => {
      console.log(`   ❌ ${type} connection failed: ${error.message}`);
      if (error.code) {
        console.log(`   Code: ${error.code}\n`);
      }
      client.end().catch(() => {});
      
      if (type === 'IPv4') {
        console.log(`\n💡 IPv4 connection failed. Possible issues:`);
        console.log(`   1. Supabase project might be paused`);
        console.log(`   2. Firewall blocking the connection`);
        console.log(`   3. Wrong credentials`);
        console.log(`   4. Network connectivity issue\n`);
        console.log(`💡 Try:`);
        console.log(`   1. Check Supabase Dashboard - is project active?`);
        console.log(`   2. Use Connection Pooling (Session mode) instead`);
        console.log(`   3. Check firewall settings\n`);
      }
      process.exit(1);
    });
}

