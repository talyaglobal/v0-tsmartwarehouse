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

async function fixRemainingColumns() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Fix warehouse_reviews.booking_id
    console.log('Fixing warehouse_reviews.booking_id...');
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warehouse_reviews') THEN
          ALTER TABLE warehouse_reviews DROP CONSTRAINT IF EXISTS warehouse_reviews_booking_id_fkey;
          ALTER TABLE warehouse_reviews ALTER COLUMN booking_id TYPE TEXT;
          ALTER TABLE warehouse_reviews ADD CONSTRAINT warehouse_reviews_booking_id_fkey 
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
          RAISE NOTICE 'warehouse_reviews.booking_id updated to TEXT';
        END IF;
      END $$;
    `);
    console.log('✅ warehouse_reviews.booking_id fixed\n');

    // Fix warehouse_messages.booking_id
    console.log('Fixing warehouse_messages.booking_id...');
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warehouse_messages') THEN
          ALTER TABLE warehouse_messages DROP CONSTRAINT IF EXISTS warehouse_messages_booking_id_fkey;
          ALTER TABLE warehouse_messages ALTER COLUMN booking_id TYPE TEXT;
          ALTER TABLE warehouse_messages ADD CONSTRAINT warehouse_messages_booking_id_fkey 
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
          RAISE NOTICE 'warehouse_messages.booking_id updated to TEXT';
        END IF;
      END $$;
    `);
    console.log('✅ warehouse_messages.booking_id fixed\n');

    // Fix inquiries.converted_booking_id
    console.log('Fixing inquiries.converted_booking_id...');
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inquiries') THEN
          ALTER TABLE inquiries DROP CONSTRAINT IF EXISTS inquiries_converted_booking_id_fkey;
          ALTER TABLE inquiries ALTER COLUMN converted_booking_id TYPE TEXT;
          ALTER TABLE inquiries ADD CONSTRAINT inquiries_converted_booking_id_fkey 
            FOREIGN KEY (converted_booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
          RAISE NOTICE 'inquiries.converted_booking_id updated to TEXT';
        END IF;
      END $$;
    `);
    console.log('✅ inquiries.converted_booking_id fixed\n');

    console.log('✅ All remaining booking_id columns fixed!');
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

fixRemainingColumns();

