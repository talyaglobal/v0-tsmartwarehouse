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

async function fixBookingsId() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Check current type
    const currentType = await client.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'bookings' AND column_name = 'id';
    `);
    
    console.log('Current bookings.id type:', currentType.rows[0].data_type, '(', currentType.rows[0].udt_name, ')');
    
    if (currentType.rows[0].data_type === 'uuid' || currentType.rows[0].udt_name === 'uuid') {
      console.log('\n⚠️  bookings.id is still UUID! Converting to TEXT...');
      
      // Drop all foreign key constraints first
      console.log('Dropping foreign key constraints...');
      await client.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE constraint_type = 'FOREIGN KEY'
              AND constraint_name IN (
                SELECT tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                  ON ccu.constraint_name = tc.constraint_name
                WHERE tc.table_schema = 'public'
                  AND ccu.table_name = 'bookings'
                  AND ccu.column_name = 'id'
              )
          ) LOOP
            EXECUTE 'ALTER TABLE ' || quote_ident(
              (SELECT table_name FROM information_schema.key_column_usage 
               WHERE constraint_name = r.constraint_name LIMIT 1)
            ) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
          END LOOP;
        END $$;
      `);
      
      // Change the type
      console.log('Changing bookings.id to TEXT...');
      await client.query('ALTER TABLE bookings ALTER COLUMN id TYPE TEXT');
      console.log('✅ bookings.id converted to TEXT');
      
      // Remove default
      console.log('Removing default value...');
      await client.query('ALTER TABLE bookings ALTER COLUMN id DROP DEFAULT');
      console.log('✅ Default value removed');
      
    } else {
      console.log('✅ bookings.id is already TEXT');
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    if (error.hint) {
      console.error('   Hint:', error.hint);
    }
    await client.end();
    process.exit(1);
  }
}

fixBookingsId();

