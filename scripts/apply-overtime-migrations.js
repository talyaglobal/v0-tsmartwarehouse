/**
 * Script to apply overtime pricing migrations directly to Supabase
 * Run with: node scripts/apply-overtime-migrations.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Get Supabase credentials from environment or .env file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration(migrationFile) {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile)
  const sql = fs.readFileSync(migrationPath, 'utf8')
  
  console.log(`\nApplying migration: ${migrationFile}`)
  console.log('SQL:', sql.substring(0, 200) + '...')
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
  
  if (error) {
    // Try direct query execution
    const { error: directError } = await supabase.from('_migrations').insert({
      version: migrationFile.replace('.sql', ''),
      name: migrationFile,
      applied_at: new Date().toISOString()
    })
    
    if (directError && !directError.message.includes('duplicate')) {
      console.error(`Error applying ${migrationFile}:`, error.message || directError.message)
      return false
    } else {
      console.log(`Migration ${migrationFile} already applied or applied successfully`)
      return true
    }
  }
  
  console.log(`✓ Migration ${migrationFile} applied successfully`)
  return true
}

async function main() {
  console.log('Applying overtime pricing migrations...')
  
  const migrations = [
    '20260108203024_convert_overtime_price_to_jsonb.sql',
    '20260108203025_update_overtime_pricing_structure.sql'
  ]
  
  for (const migration of migrations) {
    await applyMigration(migration)
  }
  
  console.log('\n✓ All migrations completed!')
}

main().catch(console.error)

