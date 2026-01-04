const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
})

async function addColumns() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    console.log('Checking existing columns...')
    
    // Check if columns exist
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
      AND column_name IN ('proposed_start_date', 'proposed_start_time', 'date_change_requested_at', 'date_change_requested_by')
    `)
    
    const existingColumns = columnCheck.rows.map(row => row.column_name)
    console.log('Existing columns:', existingColumns)

    console.log('Adding missing columns...')
    
    // Add columns if they don't exist
    if (!existingColumns.includes('proposed_start_date')) {
      console.log('Adding proposed_start_date...')
      await client.query(`
        ALTER TABLE bookings
        ADD COLUMN proposed_start_date TIMESTAMPTZ;
      `)
      console.log('✅ Added proposed_start_date')
    } else {
      console.log('⚠️  proposed_start_date already exists')
    }

    if (!existingColumns.includes('proposed_start_time')) {
      console.log('Adding proposed_start_time...')
      await client.query(`
        ALTER TABLE bookings
        ADD COLUMN proposed_start_time TIME;
      `)
      console.log('✅ Added proposed_start_time')
    } else {
      console.log('⚠️  proposed_start_time already exists')
    }

    if (!existingColumns.includes('date_change_requested_at')) {
      console.log('Adding date_change_requested_at...')
      await client.query(`
        ALTER TABLE bookings
        ADD COLUMN date_change_requested_at TIMESTAMPTZ;
      `)
      console.log('✅ Added date_change_requested_at')
    } else {
      console.log('⚠️  date_change_requested_at already exists')
    }

    if (!existingColumns.includes('date_change_requested_by')) {
      console.log('Adding date_change_requested_by...')
      await client.query(`
        ALTER TABLE bookings
        ADD COLUMN date_change_requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
      `)
      console.log('✅ Added date_change_requested_by')
    } else {
      console.log('⚠️  date_change_requested_by already exists')
    }

    // Create indexes if they don't exist
    console.log('Creating indexes...')
    
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_bookings_proposed_start_date ON bookings(proposed_start_date);
      `)
      console.log('✅ Index idx_bookings_proposed_start_date created')
    } catch (e) {
      console.log('⚠️  Index idx_bookings_proposed_start_date may already exist')
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_bookings_date_change_requested_by ON bookings(date_change_requested_by);
      `)
      console.log('✅ Index idx_bookings_date_change_requested_by created')
    } catch (e) {
      console.log('⚠️  Index idx_bookings_date_change_requested_by may already exist')
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_bookings_awaiting_time_slot_status ON bookings(warehouse_id, booking_status) 
        WHERE booking_status = 'awaiting_time_slot';
      `)
      console.log('✅ Index idx_bookings_awaiting_time_slot_status created')
    } catch (e) {
      console.log('⚠️  Index idx_bookings_awaiting_time_slot_status may already exist')
    }

    // Add comments
    console.log('Adding column comments...')
    await client.query(`
      COMMENT ON COLUMN bookings.proposed_start_date IS 'Proposed new start date by warehouse staff';
      COMMENT ON COLUMN bookings.proposed_start_time IS 'Proposed new start time by warehouse staff';
      COMMENT ON COLUMN bookings.date_change_requested_at IS 'Timestamp when warehouse staff requested date/time change';
      COMMENT ON COLUMN bookings.date_change_requested_by IS 'Warehouse staff (profile ID) who requested the date/time change';
    `)
    console.log('✅ Comments added')

    await client.query('COMMIT')
    console.log('✅ All columns added successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Failed to add columns:', error.message)
    console.error('Full error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

addColumns().catch(console.error)

