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
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  if (supabaseUrl) {
    const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      const projectRef = match[1];
      const dbPassword = env.SUPABASE_DB_PASSWORD || env.POSTGRES_PASSWORD;
      if (dbPassword) {
        dbUrl = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
      }
    }
  }
}

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found.');
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

async function checkSchema() {
  try {
    await client.connect();
    
    // Check table structure
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'supabase_migrations' 
      AND table_name = 'schema_migrations'
      ORDER BY ordinal_position
    `);
    
    console.log('Schema_migrations table structure:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Check existing migrations
    const migrations = await client.query('SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5');
    console.log('\nLast 5 migrations:');
    migrations.rows.forEach(row => {
      console.log(`  Version: ${row.version}, Name: ${row.name || 'N/A'}`);
    });
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

checkSchema();

