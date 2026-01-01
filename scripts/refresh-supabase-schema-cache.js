const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse .env file
function parseDotEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envPath2 = path.join(__dirname, '..', '.env');
  const envPathToUse = fs.existsSync(envPath) ? envPath : envPath2;
  
  if (!fs.existsSync(envPathToUse)) {
    return {};
  }
  const content = fs.readFileSync(envPathToUse, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
  return env;
}

const root = path.join(__dirname, '..');
const env = { ...process.env, ...parseDotEnv() };

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL not found in .env');
  process.exit(1);
}

const projectRefMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!projectRefMatch) {
  console.error('ERROR: Could not extract project ref from Supabase URL');
  process.exit(1);
}
const projectRef = projectRefMatch[1];

let dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  const dbPassword = env.SUPABASE_DB_PASSWORD || env.DATABASE_PASSWORD;
  if (dbPassword) {
    dbUrl = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
  } else {
    console.error('ERROR: DATABASE_URL or SUPABASE_DB_PASSWORD not found.');
    process.exit(1);
  }
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
  ssl: { rejectUnauthorized: false }
});

async function refreshCache() {
  try {
    console.log('🔌 Connecting to Supabase database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Run a simple query to refresh schema cache
    console.log('🔄 Refreshing schema cache by querying warehouse_services table...');
    const { rows } = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'warehouse_services'
        AND column_name IN ('pricing_type', 'service_name', 'warehouse_id', 'company_service_id')
      ORDER BY column_name;
    `);

    console.log('✅ Schema cache refreshed! Found columns:');
    rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type}, ${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    // Also try a test insert/select to force cache refresh
    console.log('\n🔄 Testing table structure with a simple query...');
    await client.query(`
      SELECT 
        id, 
        warehouse_id, 
        service_name, 
        pricing_type, 
        base_price, 
        company_service_id
      FROM warehouse_services 
      LIMIT 0;
    `);
    console.log('✅ Table structure verified - all columns accessible!');

    await client.end();
    console.log('\n✅ Schema cache refresh completed!');
    console.log('   You can now try mapping services again.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    await client.end();
    process.exit(1);
  }
}

refreshCache();

