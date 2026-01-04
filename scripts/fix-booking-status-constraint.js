const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
})

async function fixConstraint() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    console.log('Checking current constraint...')
    
    // First, check what constraint exists
    const constraintCheck = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'bookings'::regclass
      AND conname = 'bookings_booking_status_check'
    `)
    
    if (constraintCheck.rows.length > 0) {
      console.log('Current constraint:', constraintCheck.rows[0].definition)
    } else {
      console.log('No constraint found')
    }

    console.log('Dropping old constraint...')
    await client.query(`
      ALTER TABLE bookings 
      DROP CONSTRAINT IF EXISTS bookings_booking_status_check;
    `)

    console.log('Creating new constraint with awaiting_time_slot...')
    await client.query(`
      ALTER TABLE bookings
      ADD CONSTRAINT bookings_booking_status_check 
      CHECK (booking_status IN ('pending', 'pre_order', 'awaiting_time_slot', 'payment_pending', 'confirmed', 'active', 'completed', 'cancelled'));
    `)

    // Verify the constraint was created
    const verifyCheck = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'bookings'::regclass
      AND conname = 'bookings_booking_status_check'
    `)
    
    if (verifyCheck.rows.length > 0) {
      console.log('✅ New constraint created:', verifyCheck.rows[0].definition)
    } else {
      throw new Error('Constraint was not created')
    }

    await client.query('COMMIT')
    console.log('✅ Constraint updated successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Failed to update constraint:', error.message)
    console.error('Full error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixConstraint().catch(console.error)

