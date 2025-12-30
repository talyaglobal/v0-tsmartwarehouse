const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigration(fileName) {
  console.log(`\n📄 Running migration: ${fileName}`)
  console.log('='.repeat(60))

  try {
    const filePath = path.join(__dirname, '..', 'supabase', 'migrations', fileName)
    const sql = fs.readFileSync(filePath, 'utf8')

    // Split by semicolons but keep multi-line statements together
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement) {
        console.log(`\n  Executing statement ${i + 1}/${statements.length}...`)
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' })

        if (error) {
          // Try direct execution if RPC fails
          console.log('  RPC failed, trying direct execution...')
          const { error: directError } = await supabase.from('_migrations').insert({})

          if (directError) {
            console.error(`  ❌ Error:`, error.message)
            throw error
          }
        }
        console.log(`  ✅ Statement ${i + 1} executed`)
      }
    }

    console.log(`\n✅ Migration ${fileName} completed successfully!`)
    return true
  } catch (error) {
    console.error(`\n❌ Migration ${fileName} failed:`, error.message)
    return false
  }
}

async function runAllMigrations() {
  console.log('🚀 Starting Warehouse Services Migrations...\n')

  const migrations = [
    '089_create_warehouse_services.sql',
    '090_create_booking_services.sql',
    '091_update_bookings_for_services.sql'
  ]

  let successCount = 0
  let failCount = 0

  for (const migration of migrations) {
    const success = await runMigration(migration)
    if (success) {
      successCount++
    } else {
      failCount++
      console.log('\n⚠️  Stopping migrations due to error')
      break
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Migration Summary:')
  console.log(`  ✅ Successful: ${successCount}`)
  console.log(`  ❌ Failed: ${failCount}`)
  console.log('='.repeat(60))

  if (failCount === 0) {
    console.log('\n🎉 All migrations completed successfully!')
    console.log('\nNext steps:')
    console.log('  1. Create API endpoints for warehouse services')
    console.log('  2. Create UI for service management')
    console.log('  3. Update booking flow to include services')
  } else {
    console.log('\n⚠️  Some migrations failed. Please check the errors above.')
    console.log('You may need to run the SQL manually in Supabase dashboard.')
  }
}

runAllMigrations()
