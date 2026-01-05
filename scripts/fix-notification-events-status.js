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

async function fixStatus() {
  try {
    await client.connect();
    console.log('Connected successfully!\n');

    // Check current type
    const currentType = await client.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'notification_events' AND column_name = 'status';
    `);
    
    console.log('Current notification_events.status type:', currentType.rows[0].data_type, '(', currentType.rows[0].udt_name, ')');
    
    if (currentType.rows[0].data_type === 'boolean' || currentType.rows[0].udt_name === 'bool') {
      console.log('\n⚠️  notification_events.status is BOOLEAN! Converting to TEXT...');
      
      // Drop the check constraint first
      await client.query(`
        ALTER TABLE notification_events 
        DROP CONSTRAINT IF EXISTS notification_events_status_check;
      `);
      
      // Drop the default first
      await client.query(`
        ALTER TABLE notification_events 
        ALTER COLUMN status DROP DEFAULT;
      `);
      
      // Change the type using USING clause to convert boolean to text
      await client.query(`
        ALTER TABLE notification_events 
        ALTER COLUMN status TYPE TEXT USING 
        CASE 
          WHEN status::boolean = true THEN 'pending'
          WHEN status::boolean = false THEN 'completed'
          ELSE 'pending'
        END;
      `);
      
      // Re-add the check constraint
      await client.query(`
        ALTER TABLE notification_events 
        ADD CONSTRAINT notification_events_status_check 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
      `);
      
      // Set default
      await client.query(`
        ALTER TABLE notification_events 
        ALTER COLUMN status SET DEFAULT 'pending';
      `);
      
      console.log('✅ notification_events.status converted to TEXT');
    } else {
      console.log('✅ notification_events.status is already TEXT');
    }

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

fixStatus();

