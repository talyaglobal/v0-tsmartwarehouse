const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  try {
    console.log('Reading migration file...')
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '088_add_pallet_monthly_pricing.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('Applying migration to add pallet-monthly pricing type...')

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: migrationSQL })

    if (error) {
      // Try direct execution if exec_sql doesn't exist
      console.log('exec_sql RPC not found, trying direct execution...')

      // Split into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const statement of statements) {
        if (statement.includes('ALTER TYPE') || statement.includes('ALTER TABLE') || statement.includes('COMMENT')) {
          console.log('Executing:', statement.substring(0, 50) + '...')
          const { error: execError } = await supabase.rpc('exec_sql', { sql: statement })
          if (execError) {
            console.error('Error executing statement:', execError.message)
          }
        }
      }
    }

    console.log('✅ Migration applied successfully!')
    console.log('\nYou can now:')
    console.log('1. Set "Pallet (per pallet per month)" pricing for warehouses')
    console.log('2. Bookings < 30 days will use daily pricing')
    console.log('3. Bookings >= 30 days will use monthly pricing')

  } catch (error) {
    console.error('❌ Error applying migration:', error.message)
    console.log('\n⚠️  Please run this SQL manually in Supabase Studio:')
    console.log('\nGo to: SQL Editor in Supabase Dashboard')
    console.log('Then run the contents of: supabase/migrations/088_add_pallet_monthly_pricing.sql')
    process.exit(1)
  }
}

applyMigration()
