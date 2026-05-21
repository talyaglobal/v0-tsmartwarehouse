/**
 * Push SQL migrations to KolayBase PostgreSQL database
 *
 * Reads all migration files in order, strips Supabase-specific SQL
 * (auth.users refs, RLS policies, storage, realtime), and executes
 * the DDL against DATABASE_URL.
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set in .env')
  process.exit(1)
}

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'supabase', 'migrations')

// Files to skip entirely (purely Supabase-specific)
const SKIP_FILES = [
  '003_enable_realtime',
  '004_rls_policies',
  '006_create_admin_user',
  '012_setup_docs_storage',
  '036_add_profiles_insert_policy',
  '038_disable_profile_trigger',
  '064_update_rls_policies',
  '066_update_rls_policies',
  '068_setup_files_storage',
  '069_add_avatar_policies',
  '075_setup_warehouse_photos_storage',
  '095_update_company_services_rls',
  '108_fix_warehouse_photos_rls',
  '20241128160006_storage_bucket_setup',
  '20260129100003_add_rls_policies',
  '20260129140000_fix_client_team_members_rls',
  '20260202110000_profiles_view_same_company',
  '20260206140000_conversations_warehouse_staff_rls',
]

function filterSQL(sql) {
  // 1) Replace auth.users FK references with plain UUID
  sql = sql.replace(/REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s*(ON\s+DELETE\s+CASCADE)?/gi, '')

  // 2) Remove CREATE/DROP TRIGGER on auth.users
  sql = sql.replace(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+\w+\s+ON\s+auth\.users\s*;/gi, '')
  sql = sql.replace(/CREATE\s+TRIGGER[\s\S]*?ON\s+auth\.users[\s\S]*?;/gi, '')

  // 3) Remove all CREATE/DROP/ALTER POLICY statements
  // Use line-by-line approach to avoid greedy matching issues
  const lines = sql.split('\n')
  const filtered = []
  let inPolicy = false
  let parenDepth = 0

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip RLS enable/disable
    if (/ALTER\s+TABLE\s+\S+\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(trimmed)) {
      filtered.push(`-- [FILTERED RLS] ${line}`)
      continue
    }
    if (/ALTER\s+TABLE\s+\S+\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(trimmed)) {
      filtered.push(`-- [FILTERED RLS] ${line}`)
      continue
    }

    // Detect start of policy statement
    if (/^\s*(CREATE|DROP|ALTER)\s+POLICY\b/i.test(trimmed)) {
      inPolicy = true
      parenDepth = 0
    }

    if (inPolicy) {
      // Count parens
      for (const ch of trimmed) {
        if (ch === '(') parenDepth++
        if (ch === ')') parenDepth--
      }
      filtered.push(`-- [FILTERED POLICY] ${line}`)
      // End policy when we see ; and parens are balanced
      if (trimmed.endsWith(';') && parenDepth <= 0) {
        inPolicy = false
      }
      continue
    }

    // Remove supabase_realtime publication statements
    if (/supabase_realtime/i.test(trimmed)) {
      filtered.push(`-- [FILTERED REALTIME] ${line}`)
      continue
    }

    // Remove storage schema references
    if (/\bstorage\.\w+/i.test(trimmed) && !trimmed.startsWith('--')) {
      filtered.push(`-- [FILTERED STORAGE] ${line}`)
      continue
    }

    // Remove GRANT to supabase_ roles
    if (/GRANT\s+.*\bsupabase_/i.test(trimmed)) {
      filtered.push(`-- [FILTERED GRANT] ${line}`)
      continue
    }

    // Remove auth.uid()/jwt()/role() references in non-comment lines
    if (/\bauth\.(uid|jwt|role)\s*\(/i.test(trimmed) && !trimmed.startsWith('--')) {
      filtered.push(`-- [FILTERED AUTH] ${line}`)
      continue
    }

    filtered.push(line)
  }

  return filtered.join('\n')
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL })

  try {
    console.log('Connecting to KolayBase database...')
    await client.connect()
    console.log('Connected!\n')

    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    // Get already applied migrations
    const { rows: applied } = await client.query('SELECT name FROM _migrations')
    const appliedSet = new Set(applied.map(r => r.name))

    // Read and sort migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()

    console.log(`Found ${files.length} migration files, ${appliedSet.size} already applied.\n`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (const file of files) {
      if (appliedSet.has(file)) {
        skipCount++
        continue
      }

      // Skip Supabase-specific files
      if (SKIP_FILES.some(skip => file.includes(skip))) {
        console.log(`SKIP  ${file}`)
        await client.query('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file])
        skipCount++
        continue
      }

      const filePath = path.join(MIGRATIONS_DIR, file)
      let sql = fs.readFileSync(filePath, 'utf-8')
      sql = filterSQL(sql)

      // Skip if nothing meaningful remains
      const meaningful = sql.split('\n').filter(l => {
        const t = l.trim()
        return t && !t.startsWith('--') && t !== ''
      })
      if (meaningful.length === 0) {
        console.log(`SKIP  ${file} (empty after filter)`)
        await client.query('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file])
        skipCount++
        continue
      }

      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`OK    ${file}`)
        successCount++
      } catch (err) {
        await client.query('ROLLBACK')
        const msg = (err.message || '').substring(0, 120)
        console.log(`WARN  ${file}: ${msg}`)
        await client.query('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file])
        errorCount++
      }
    }

    console.log(`\n========================================`)
    console.log(`  Applied:  ${successCount}`)
    console.log(`  Skipped:  ${skipCount}`)
    console.log(`  Warnings: ${errorCount}`)
    console.log(`========================================`)

    // Show created tables
    const { rows: tables } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)
    console.log(`\nTables (${tables.length}):`)
    tables.forEach(t => console.log(`  ${t.tablename}`))

  } catch (err) {
    console.error('Fatal:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
