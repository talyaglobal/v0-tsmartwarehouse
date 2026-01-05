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

    // Drop all constraints and indexes on status
    await client.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'notification_events'
            AND constraint_name LIKE '%status%'
        ) LOOP
          EXECUTE 'ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
        END LOOP;
      END $$;
    `);
    
    // Drop default
    await client.query(`ALTER TABLE notification_events ALTER COLUMN status DROP DEFAULT;`);
    
    // Add a temporary column
    await client.query(`ALTER TABLE notification_events ADD COLUMN status_temp TEXT;`);
    
    // Copy data
    await client.query(`
      UPDATE notification_events 
      SET status_temp = CASE 
        WHEN status = true THEN 'pending'
        WHEN status = false THEN 'completed'
        ELSE 'pending'
      END;
    `);
    
    // Drop old column
    await client.query(`ALTER TABLE notification_events DROP COLUMN status;`);
    
    // Rename temp column
    await client.query(`ALTER TABLE notification_events RENAME COLUMN status_temp TO status;`);
    
    // Add constraint and default
    await client.query(`
      ALTER TABLE notification_events 
      ADD CONSTRAINT notification_events_status_check 
      CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
    `);
    
    await client.query(`
      ALTER TABLE notification_events 
      ALTER COLUMN status SET DEFAULT 'pending';
    `);
    
    console.log('✅ notification_events.status converted to TEXT');

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

