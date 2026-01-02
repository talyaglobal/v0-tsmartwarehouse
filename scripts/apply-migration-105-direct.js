const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
})

async function applyMigration() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Read migration file
    const fs = require('fs')
    const path = require('path')
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/105_add_awaiting_time_slot_status.sql'),
      'utf8'
    )

    console.log('Applying migration 105_add_awaiting_time_slot_status.sql...')
    await client.query(migrationSQL)

    // Try to record migration (may fail if schema_migrations structure is different)
    try {
      const migrationName = '105_add_awaiting_time_slot_status'
      await client.query(
        `INSERT INTO schema_migrations (version, statements) 
         VALUES ($1, ARRAY[$2])
         ON CONFLICT (version) DO NOTHING`,
        [migrationName, migrationSQL]
      )
      console.log('✅ Migration recorded in schema_migrations')
    } catch (recordError) {
      console.log('⚠️  Could not record migration in schema_migrations (this is OK if migration was already applied)')
    }

    await client.query('COMMIT')
    console.log('✅ Migration 105 applied successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Failed to apply migration:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

applyMigration().catch(console.error)

