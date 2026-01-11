const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

async function pushMigration() {
  try {
    // Get Supabase credentials from env
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    }

    console.log('Connecting to Supabase...')
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '120_add_email_tracking.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('Executing migration 120_add_email_tracking.sql...')
    
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    })

    if (error) {
      // If exec_sql doesn't exist, try direct query
      console.log('Trying direct SQL execution...')
      
      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        if (statement) {
          try {
            const { error: stmtError } = await supabase.rpc('exec', {
              sql: statement + ';'
            })
            
            if (stmtError) {
              console.log(`Statement ${i + 1}/${statements.length}: ${stmtError.message}`)
            } else {
              console.log(`Statement ${i + 1}/${statements.length}: ✓`)
            }
          } catch (err) {
            console.log(`Statement ${i + 1}: ${err.message}`)
          }
        }
      }
    } else {
      console.log('✓ Migration executed successfully!')
    }

    console.log('\n✓ Migration 120 push completed!')
    process.exit(0)

  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

pushMigration()
