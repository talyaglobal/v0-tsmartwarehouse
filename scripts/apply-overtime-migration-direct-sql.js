const { Client } = require('pg')
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

// Get database connection string
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const dbPassword = env.SUPABASE_DB_PASSWORD || env.DATABASE_PASSWORD

// Extract project ref from Supabase URL to build connection string
const urlMatch = supabaseUrl?.match(/https?:\/\/([^.]+)\.supabase\.co/)
const projectRef = urlMatch ? urlMatch[1] : null

// Build PostgreSQL connection string
// Format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
// Or use DATABASE_URL if available
let connectionString = env.DATABASE_URL

if (!connectionString && projectRef && dbPassword) {
  // Try to construct connection string
  // Note: This might need adjustment based on your Supabase setup
  connectionString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
}

if (!connectionString) {
  console.error('ERROR: DATABASE_URL or Supabase credentials not found')
  console.error('Please set DATABASE_URL in .env.local or provide SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
})

async function applyMigration() {
  try {
    console.log('🚀 Applying overtime_price migration directly to database...\n')
    
    await client.connect()
    console.log('✅ Connected to database\n')

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260108203024_convert_overtime_price_to_jsonb.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📄 Migration file loaded')
    console.log('🔧 Executing migration SQL...\n')

    // Execute the entire migration SQL
    await client.query(migrationSQL)

    console.log('✅ Migration applied successfully!\n')
    console.log('📋 Changes applied:')
    console.log('   - overtime_price column converted from DECIMAL to JSONB')
    console.log('   - Existing values migrated to new format')
    console.log('   - Column renamed and comment added\n')

    await client.end()
    process.exit(0)

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    if (error.code) {
      console.error('   Error code:', error.code)
    }
    if (error.detail) {
      console.error('   Detail:', error.detail)
    }
    if (error.hint) {
      console.error('   Hint:', error.hint)
    }
    
    await client.end()
    process.exit(1)
  }
}

applyMigration()

