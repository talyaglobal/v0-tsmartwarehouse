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

async function testInsert() {
  try {
    await client.connect();
    
    // Get a valid customer_id and warehouse_id
    const customer = await client.query('SELECT id FROM profiles WHERE role = \'customer\' LIMIT 1');
    const warehouse = await client.query('SELECT id FROM warehouses LIMIT 1');
    
    if (customer.rows.length === 0 || warehouse.rows.length === 0) {
      console.error('No customer or warehouse found');
      await client.end();
      process.exit(1);
    }
    
    const testBookingId = 'TEST-00000-ARE-TEST';
    console.log(`Testing insert with ID: ${testBookingId}`);
    console.log(`Customer ID: ${customer.rows[0].id}`);
    console.log(`Warehouse ID: ${warehouse.rows[0].id}`);
    
    try {
      const result = await client.query(`
        INSERT INTO bookings (id, customer_id, customer_name, customer_email, warehouse_id, type, booking_status, total_amount, start_date)
        VALUES ($1, $2, 'Test Customer', 'test@test.com', $3, 'area-rental', 'pending', 100, CURRENT_DATE)
        RETURNING id;
      `, [testBookingId, customer.rows[0].id, warehouse.rows[0].id]);
      
      console.log('✅ Insert successful!');
      await client.query('DELETE FROM bookings WHERE id = $1', [testBookingId]);
    } catch (error) {
      console.error('❌ Insert failed:');
      console.error('   Message:', error.message);
      console.error('   Code:', error.code);
      console.error('   Detail:', error.detail);
      console.error('   Hint:', error.hint);
      console.error('   Position:', error.position);
      if (error.where) {
        console.error('   Where:', error.where);
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

testInsert();

