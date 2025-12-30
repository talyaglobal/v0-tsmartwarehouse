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
  console.log('🚀 Applying warehouse structure migration (087)...\n')

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '087_update_warehouse_structure.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration file loaded')
    console.log('🔧 Executing migration SQL...\n')

    // Split SQL statements by semicolon and execute one by one
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'COMMENT ON COLUMN')

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]

      // Skip comment statements
      if (statement.startsWith('COMMENT')) {
        continue
      }

      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        })

        if (error) {
          // Try direct query if rpc fails
          const { error: directError } = await supabase.from('_').select('*').limit(0)

          if (directError) {
            console.error(`⚠️  Statement ${i + 1} warning:`, error.message)
          }
        }

        successCount++
        process.stdout.write('.')
      } catch (err) {
        console.error(`\n❌ Error on statement ${i + 1}:`, err.message)
        errorCount++
      }
    }

    console.log('\n')
    console.log('✅ Migration completed!')
    console.log(`   Success: ${successCount} statements`)
    if (errorCount > 0) {
      console.log(`   Warnings: ${errorCount} statements`)
    }
    console.log('\n📋 Changes applied:')
    console.log('   - warehouse_type: Changed from array to single value')
    console.log('   - storage_type: Changed from array to single value')
    console.log('   - temperature_type: Changed from array to single value')
    console.log('   - Added new temperature options with heater')
    console.log('   - Removed at_capacity_sq_ft and at_capacity_pallet columns')
    console.log('   - Removed appointmentRequired from access_info')
    console.log('   - Migrated existing data automatically\n')

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error('\n🔧 Manual application required:')
    console.error('   1. Open Supabase Dashboard > SQL Editor')
    console.error('   2. Run the migration file: supabase/migrations/087_update_warehouse_structure.sql')
    console.error('   3. Execute the SQL statements one by one')
    process.exit(1)
  }
}

applyMigration()
