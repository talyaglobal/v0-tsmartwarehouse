const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function parseDotEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return {}
  }
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  content.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
      }
    }
  })
  return env
}

const root = path.resolve(__dirname, '..')
const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')]
const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0]
const env = Object.assign({}, process.env, parseDotEnv(envPath))
const dbUrl = env.DATABASE_URL

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in .env or environment.')
  process.exit(1)
}

// Parse DATABASE_URL
const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
if (!urlMatch) {
  console.error('ERROR: Invalid DATABASE_URL format.')
  process.exit(1)
}

const [, user, password, host, port, database] = urlMatch

const client = new Client({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  ssl: {
    rejectUnauthorized: false
  }
})

async function runMigration() {
  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('Connected successfully!')

    const migrationPath = path.join(root, 'supabase', 'migrations', '111_migrate_company_admin_to_warehouse_admin.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('Running migration 111: Migrate company_admin to warehouse_admin...')
    await client.query(migrationSQL)
    console.log('✅ Migration 111 applied successfully!')

    await client.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    if (error.code) {
      console.error('Error code:', error.code)
    }
    if (error.detail) {
      console.error('Detail:', error.detail)
    }
    if (error.position) {
      console.error('Position:', error.position)
    }
    await client.end()
    process.exit(1)
  }
}

runMigration()
