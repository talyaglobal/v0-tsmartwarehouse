const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

// Supabase connection string format:
// postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

if (!connectionString) {
  console.error('❌ No DATABASE_URL or SUPABASE_DB_URL found in .env.local')
  console.log('\n📝 Please add your Supabase database connection string to .env.local:')
  console.log('DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
  console.log('\nYou can find this in Supabase Dashboard > Project Settings > Database > Connection String (URI)')
  process.exit(1)
}

async function applyConstraint() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('✅ Connected\n')

    // Step 1: Drop existing constraint
    console.log('1. Dropping existing check constraint...')
    await client.query(`
      ALTER TABLE warehouse_pricing
      DROP CONSTRAINT IF EXISTS warehouse_pricing_pricing_type_check;
    `)
    console.log('✅ Constraint dropped\n')

    // Step 2: Add new constraint
    console.log('2. Adding new constraint with pallet-monthly...')
    await client.query(`
      ALTER TABLE warehouse_pricing
      ADD CONSTRAINT warehouse_pricing_pricing_type_check
      CHECK (pricing_type IN ('pallet', 'pallet-monthly', 'area', 'area-rental'));
    `)
    console.log('✅ New constraint added\n')

    // Step 3: Verify
    console.log('3. Verifying constraint...')
    const result = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'warehouse_pricing'::regclass
      AND conname = 'warehouse_pricing_pricing_type_check';
    `)

    if (result.rows.length > 0) {
      console.log('✅ Constraint verified:')
      console.log('   Name:', result.rows[0].conname)
      console.log('   Definition:', result.rows[0].definition)
    }

    console.log('\n🎉 Success! You can now use "pallet-monthly" pricing type.')

  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('connect')) {
      console.log('\n📝 Connection failed. Please check your DATABASE_URL in .env.local')
    }
  } finally {
    await client.end()
  }
}

applyConstraint()
