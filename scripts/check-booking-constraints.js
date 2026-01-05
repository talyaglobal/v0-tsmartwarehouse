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

async function checkConstraints() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Try to insert a test booking with the new format
    const testBookingId = 'TEST-00000-ARE-TEST';
    console.log(`Attempting to insert test booking with ID: ${testBookingId}`);
    
    try {
      const result = await client.query(`
        INSERT INTO bookings (id, customer_id, customer_name, customer_email, warehouse_id, type, booking_status, total_amount, start_date)
        VALUES ($1, (SELECT id FROM profiles LIMIT 1), 'Test Customer', 'test@test.com', (SELECT id FROM warehouses LIMIT 1), 'area-rental', 'pending', 100, CURRENT_DATE)
        RETURNING id;
      `, [testBookingId]);
      
      console.log('✅ Test insert successful!');
      console.log('Inserted booking ID:', result.rows[0].id);
      
      // Clean up
      await client.query('DELETE FROM bookings WHERE id = $1', [testBookingId]);
      console.log('✅ Test booking deleted');
    } catch (insertError) {
      console.error('❌ Test insert failed:', insertError.message);
      if (insertError.detail) {
        console.error('   Detail:', insertError.detail);
      }
      if (insertError.hint) {
        console.error('   Hint:', insertError.hint);
      }
      console.error('   Code:', insertError.code);
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

checkConstraints();

