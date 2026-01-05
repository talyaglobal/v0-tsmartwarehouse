const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function parseDotEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach((line) => {
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

const root = path.resolve(__dirname, '..');
const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')];
const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0];
const env = Object.assign({}, process.env, parseDotEnv(envPath));
const dbUrl = env.DATABASE_URL;

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in .env or environment.');
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

async function fixNotificationTrigger() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    const migrationPath = path.join(root, 'supabase', 'migrations', '026_create_notification_triggers.sql');
    let migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Update the function to use TEXT instead of UUID for entity_id_value
    migrationSQL = migrationSQL.replace(
      /entity_id_value UUID;/g,
      'entity_id_value TEXT; -- Changed from UUID to TEXT to support both UUID and TEXT booking IDs'
    );
    
    console.log('Updating create_notification_event function...');
    await client.query(migrationSQL);
    console.log('✅ Function updated successfully!');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    await client.end();
    process.exit(1);
  }
}

fixNotificationTrigger();

