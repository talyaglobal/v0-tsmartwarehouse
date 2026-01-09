const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
function parseDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf8')
  const lines = content.split(/\r?\n/)
  const obj = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx)
    let val = trimmed.slice(idx + 1)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    obj[key] = val
  }
  return obj
}

const root = path.resolve(__dirname, '..')
const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')]
const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0]
const env = Object.assign({}, process.env, parseDotEnv(envPath))

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing required environment variables')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function pushMigration() {
  try {
    console.log('🚀 Pushing overtime_price migration to Supabase...\n')

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260108203024_convert_overtime_price_to_jsonb.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration file loaded')
    console.log('🔧 Executing migration SQL statements...\n')

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    let successCount = 0
    let errorCount = 0

    // Execute each statement using Supabase REST API
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement || statement.length < 10) continue

      const statementWithSemicolon = statement + ';'
      console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 60)}...`)

      try {
        // Use Supabase REST API to execute SQL via pg_net extension or direct query
        // Try using the REST API endpoint for SQL execution
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ sql_query: statementWithSemicolon })
        })

        if (response.ok) {
          console.log(`   ✅ Success`)
          successCount++
        } else {
          // If RPC doesn't exist, try alternative: execute via direct SQL query
          // We'll use a workaround: create a function that executes SQL
          console.log(`   ⚠️  RPC method not available, trying alternative...`)
          
          // Alternative: Use Supabase's query builder to execute via a helper function
          // Since we can't execute raw SQL directly, we'll need to use the Management API
          // or provide instructions for manual execution
          
          // For now, mark as needing manual execution
          errorCount++
          console.log(`   ⚠️  Statement needs manual execution`)
        }
      } catch (err) {
        console.error(`   ❌ Error: ${err.message}`)
        errorCount++
      }
    }

    if (errorCount > 0) {
      console.log('\n⚠️  Some statements could not be executed automatically.')
      console.log('Please execute the migration manually via Supabase Dashboard:\n')
      console.log('1. Go to: https://app.supabase.com/project/[YOUR_PROJECT]/sql/new')
      console.log('2. Copy and paste the following SQL:\n')
      console.log('─'.repeat(80))
      console.log(migrationSQL)
      console.log('─'.repeat(80))
      console.log('\n3. Click "Run" to execute\n')
    } else {
      console.log('\n✅ Migration applied successfully!')
      console.log(`   Successfully executed ${successCount} statements\n`)
    }

    // Also try using Supabase CLI if available
    console.log('📋 Alternative: Using Supabase CLI to push migration...')
    const { execSync } = require('child_process')
    try {
      execSync('npx supabase db push --include-all', { 
        stdio: 'inherit',
        cwd: root 
      })
      console.log('\n✅ Migration pushed via Supabase CLI!')
    } catch (cliError) {
      console.log('\n⚠️  Supabase CLI push failed (this is expected if migrations are out of sync)')
      console.log('   Please use the manual method above or fix migration sync issues\n')
    }

  } catch (error) {
    console.error('❌ Migration push failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

pushMigration()

