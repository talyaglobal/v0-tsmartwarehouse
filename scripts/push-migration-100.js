const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function pushMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/100_add_warehouse_fees_and_transportation.sql')
  const sql = fs.readFileSync(migrationPath, 'utf8')

  console.log('Applying migration 100_add_warehouse_fees_and_transportation.sql...')

  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    if (statement.trim()) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
        if (error) {
          // Try direct query if RPC doesn't work
          const { error: queryError } = await supabase.from('_temp').select('*').limit(0)
          if (queryError && error.message.includes('exec_sql')) {
            console.warn('RPC exec_sql not available, trying direct execution...')
            // For direct execution, we'd need to use pg client
            console.log('Please apply this migration manually via Supabase Dashboard SQL Editor')
            console.log('Migration SQL:')
            console.log(sql)
            process.exit(0)
          } else {
            throw error
          }
        }
      } catch (error) {
        // If exec_sql RPC doesn't exist, we need to use pg client
        console.error('Error applying migration:', error.message)
        console.log('\nPlease apply this migration manually via Supabase Dashboard SQL Editor')
        console.log('Migration file:', migrationPath)
        process.exit(1)
      }
    }
  }

  console.log('Migration applied successfully!')
}

pushMigration().catch(console.error)

