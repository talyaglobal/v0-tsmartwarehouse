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

let dbUrl = env.DATABASE_URL;

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found');
  process.exit(1);
}

const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.error('ERROR: Invalid DATABASE_URL format.');
  process.exit(1);
}

const [, user, password, host, port, database] = urlMatch;

const client = new Client({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkSpecificObjects() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    console.log('🔍 Checking specific objects from migrations 055-060...\n');

    const checks = [
      { name: 'warehouse_capacity_snapshots table', query: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='warehouse_capacity_snapshots')` },
      { name: 'get_customer_payment_remaining function', query: `SELECT EXISTS (SELECT FROM pg_proc WHERE proname='get_customer_payment_remaining')` },
      { name: 'customer_stock_levels table', query: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='customer_stock_levels')` },
      { name: 'expected_release_date column in inventory_items', query: `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory_items' AND column_name='expected_release_date')` },
      { name: 'brokers table', query: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='brokers')` },
      { name: 'worker_performance table', query: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='worker_performance')` },
    ];

    for (const check of checks) {
      try {
        const result = await client.query(check.query);
        const exists = result.rows[0].exists;
        console.log(`${exists ? '✅' : '❌'} ${check.name}`);
      } catch (error) {
        console.log(`❌ ${check.name} - ERROR: ${error.message}`);
      }
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Check failed:', error.message);
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

checkSpecificObjects();

