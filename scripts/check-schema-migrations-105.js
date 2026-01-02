const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
})

async function checkSchema() {
  const client = await pool.connect()
  try {
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'schema_migrations'
      ORDER BY ordinal_position
    `)
    console.log('Schema migrations columns:')
    console.log(result.rows)
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

checkSchema()

