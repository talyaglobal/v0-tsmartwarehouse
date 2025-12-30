const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkSchema() {
  console.log('🔍 Checking warehouse table schema...\n')

  try {
    // Query information_schema to get column names
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ Error querying warehouses:', error.message)
      return
    }

    if (data && data.length > 0) {
      const columns = Object.keys(data[0])
      console.log('📋 Available columns in warehouses table:')
      console.log(columns.join('\n'))

      console.log('\n🔎 Checking for specific columns:')
      console.log('- warehouse_type:', columns.includes('warehouse_type') ? '✅' : '❌')
      console.log('- storage_type:', columns.includes('storage_type') ? '✅' : '❌')
      console.log('- storage_types:', columns.includes('storage_types') ? '✅' : '❌')
      console.log('- temperature_type:', columns.includes('temperature_type') ? '✅' : '❌')
      console.log('- temperature_types:', columns.includes('temperature_types') ? '✅' : '❌')
      console.log('- at_capacity_sq_ft:', columns.includes('at_capacity_sq_ft') ? '✅' : '❌')
      console.log('- at_capacity_pallet:', columns.includes('at_capacity_pallet') ? '✅' : '❌')
    } else {
      console.log('⚠️  No warehouses found in the database')
    }
  } catch (err) {
    console.error('❌ Error:', err.message)
  }
}

checkSchema()
