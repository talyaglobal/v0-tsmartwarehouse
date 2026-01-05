const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL or SUPABASE_DB_URL not found in environment variables');
  process.exit(1);
}

async function pushMigration() {
  const client = new Client({
    connectionString: connectionString,
  });

  try {
    await client.connect();
    console.log('Connecting to database...');
    console.log('Connected successfully!');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '092_update_booking_ids_to_short_format.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration 092: Update booking IDs to short format...');

    // Execute migration
    await client.query(sql);

    console.log('✅ Migration 092 applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    if (error.hint) {
      console.error('   Hint:', error.hint);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

pushMigration();

