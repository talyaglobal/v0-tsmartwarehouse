const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

async function pushMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('✓ Connected!')

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '120_add_email_tracking.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('Executing migration 120_add_email_tracking.sql...')
    
    // Execute the migration
    await client.query(migrationSQL)
    
    console.log('✓ Migration executed successfully!')
    
    // Insert into schema_migrations
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
      VALUES ('120', '120_add_email_tracking', ARRAY['Email tracking system'])
      ON CONFLICT (version) DO NOTHING
    `)
    
    console.log('✓ Migration recorded in schema_migrations')
    console.log('\n✅ Migration 120 completed successfully!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.detail) console.error('Detail:', error.detail)
    process.exit(1)
  } finally {
    await client.end()
  }
}

pushMigration()
