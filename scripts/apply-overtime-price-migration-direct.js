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

async function applyMigration() {
  try {
    console.log('🚀 Applying overtime_price migration (convert DECIMAL to JSONB)...\n')

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260108203024_convert_overtime_price_to_jsonb.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration file loaded')
    console.log('🔧 Executing migration SQL statements...\n')

    // Execute SQL statements one by one using Supabase's REST API
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement || statement.length < 10) continue

      console.log(`[${i + 1}/${statements.length}] Executing statement...`)
      console.log(`   ${statement.substring(0, 80)}${statement.length > 80 ? '...' : ''}`)

      // Use Supabase REST API to execute SQL
      // Note: Supabase doesn't have a direct SQL execution endpoint
      // We'll use the Management API or provide instructions
      try {
        // Try to execute via RPC if available
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
        
        if (error) {
          console.log(`   ⚠️  RPC method not available, statement will need manual execution`)
        } else {
          console.log(`   ✅ Statement executed successfully`)
        }
      } catch (err) {
        console.log(`   ⚠️  Could not execute via RPC: ${err.message}`)
      }
    }

    console.log('\n⚠️  Note: Supabase JS client does not support direct SQL execution.')
    console.log('Please execute the migration manually via Supabase Dashboard SQL Editor:\n')
    console.log('1. Go to: https://app.supabase.com/project/[YOUR_PROJECT]/sql/new')
    console.log('2. Copy and paste the following SQL:\n')
    console.log('─'.repeat(80))
    console.log(migrationSQL)
    console.log('─'.repeat(80))
    console.log('\n3. Click "Run" to execute the migration\n')
    
    console.log('✅ Migration script completed. Please verify the migration was applied.')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

applyMigration()

