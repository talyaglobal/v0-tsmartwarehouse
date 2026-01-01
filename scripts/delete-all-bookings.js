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

async function deleteAllBookings() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // First, check how many bookings exist
    const countResult = await client.query('SELECT COUNT(*) as count FROM bookings');
    const count = parseInt(countResult.rows[0].count);
    console.log(`\nFound ${count} bookings in the database.`);

    if (count === 0) {
      console.log('No bookings to delete.');
      await client.end();
      process.exit(0);
    }

    // Delete related records first (to avoid foreign key constraints)
    console.log('\nDeleting related records...');
    
    // Delete invoices related to bookings
    const invoiceResult = await client.query(`
      DELETE FROM invoices 
      WHERE booking_id IN (SELECT id FROM bookings)
    `);
    console.log(`  Deleted ${invoiceResult.rowCount} invoices`);

    // Delete tasks related to bookings
    const taskResult = await client.query(`
      DELETE FROM tasks 
      WHERE booking_id IN (SELECT id FROM bookings)
    `);
    console.log(`  Deleted ${taskResult.rowCount} tasks`);

    // Delete incidents related to bookings
    const incidentResult = await client.query(`
      DELETE FROM incidents 
      WHERE affected_booking_id IN (SELECT id FROM bookings)
    `);
    console.log(`  Deleted ${incidentResult.rowCount} incidents`);

    // Delete claims related to bookings
    const claimResult = await client.query(`
      DELETE FROM claims 
      WHERE booking_id IN (SELECT id FROM bookings)
    `);
    console.log(`  Deleted ${claimResult.rowCount} claims`);

    // Delete inventory items related to bookings
    const inventoryResult = await client.query(`
      DELETE FROM inventory_items 
      WHERE booking_id IN (SELECT id FROM bookings)
    `);
    console.log(`  Deleted ${inventoryResult.rowCount} inventory items`);

    // Delete booking services (if table exists)
    try {
      const bookingServiceResult = await client.query(`
        DELETE FROM booking_services 
        WHERE booking_id IN (SELECT id FROM bookings)
      `);
      console.log(`  Deleted ${bookingServiceResult.rowCount} booking services`);
    } catch (err) {
      // Table might not exist, skip
      console.log(`  Skipping booking_services (table may not exist)`);
    }

    // Now delete all bookings
    console.log('\nDeleting all bookings...');
    const deleteResult = await client.query('DELETE FROM bookings');
    console.log(`✅ Deleted ${deleteResult.rowCount} bookings`);

    // Verify deletion
    const verifyResult = await client.query('SELECT COUNT(*) as count FROM bookings');
    const remainingCount = parseInt(verifyResult.rows[0].count);
    
    if (remainingCount === 0) {
      console.log('\n✅ All bookings successfully deleted!');
    } else {
      console.log(`\n⚠️  Warning: ${remainingCount} bookings still remain.`);
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to delete bookings:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    if (error.hint) {
      console.error('Hint:', error.hint);
    }
    await client.end();
    process.exit(1);
  }
}

deleteAllBookings();

