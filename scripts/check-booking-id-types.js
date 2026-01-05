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

async function checkBookingIdTypes() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Check all tables with booking_id columns
    const query = `
      SELECT 
        table_name,
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns
      WHERE column_name LIKE '%booking_id%'
        OR column_name LIKE '%affected_booking_id%'
      ORDER BY table_name, column_name;
    `;

    const result = await client.query(query);
    
    console.log('Tables with booking_id columns:');
    console.log('================================\n');
    
    const uuidColumns = [];
    result.rows.forEach(row => {
      const isUuid = row.data_type === 'uuid' || row.udt_name === 'uuid';
      console.log(`${row.table_name}.${row.column_name}: ${row.data_type} (${row.udt_name})${isUuid ? ' ⚠️  STILL UUID!' : ''}`);
      if (isUuid) {
        uuidColumns.push(`${row.table_name}.${row.column_name}`);
      }
    });

    if (uuidColumns.length > 0) {
      console.log('\n⚠️  WARNING: The following columns are still UUID:');
      uuidColumns.forEach(col => console.log(`  - ${col}`));
    } else {
      console.log('\n✅ All booking_id columns are TEXT!');
    }

    // Also check bookings table id type
    const bookingsQuery = `
      SELECT 
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns
      WHERE table_name = 'bookings' AND column_name = 'id';
    `;
    
    const bookingsResult = await client.query(bookingsQuery);
    if (bookingsResult.rows.length > 0) {
      const row = bookingsResult.rows[0];
      console.log(`\nbookings.id: ${row.data_type} (${row.udt_name})`);
      if (row.data_type === 'uuid' || row.udt_name === 'uuid') {
        console.log('⚠️  WARNING: bookings.id is still UUID!');
      } else {
        console.log('✅ bookings.id is TEXT!');
      }
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

checkBookingIdTypes();

