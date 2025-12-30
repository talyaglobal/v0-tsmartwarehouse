const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  console.log('🚀 Applying customer booking restriction migration...\n')

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '086_restrict_customer_booking_delete.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration file loaded')
    console.log('🔧 Executing SQL...\n')

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      // Try direct execution if rpc fails
      console.log('⚠️  RPC method failed, trying direct execution...')

      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const statement of statements) {
        const { error: execError } = await supabase.rpc('exec', { query: statement })
        if (execError) {
          console.error('❌ Error executing statement:', execError.message)
          throw execError
        }
      }
    }

    console.log('✅ Migration applied successfully!\n')
    console.log('📋 Changes applied:')
    console.log('   - Customers can NO LONGER delete bookings')
    console.log('   - Customers can CANCEL bookings (update status to cancelled)')
    console.log('   - Only company staff can DELETE bookings')
    console.log('   - RLS policies updated for bookings table\n')

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error('\n🔧 Manual application required:')
    console.error('   1. Open Supabase Dashboard > SQL Editor')
    console.error('   2. Run the migration file: supabase/migrations/086_restrict_customer_booking_delete.sql')
    process.exit(1)
  }
}

applyMigration()
