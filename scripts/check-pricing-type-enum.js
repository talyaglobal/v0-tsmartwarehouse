const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkEnum() {
  try {
    console.log('Checking pricing_type enum values...\n')

    // Try to query enum values
    const { data, error } = await supabase
      .from('warehouse_pricing')
      .select('pricing_type')
      .limit(1)

    if (error) {
      console.error('Error querying warehouse_pricing:', error.message)
    }

    // Try inserting a test record with 'pallet-monthly'
    console.log('Testing pallet-monthly insertion...')

    // First, get a warehouse ID
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select('id')
      .limit(1)
      .single()

    if (!warehouses) {
      console.log('⚠️  No warehouses found to test with')
      return
    }

    const testData = {
      warehouse_id: warehouses.id,
      pricing_type: 'pallet-monthly',
      base_price: 100,
      unit: 'per_pallet_per_month',
      status: true
    }

    console.log('Test payload:', testData)

    const { data: insertData, error: insertError } = await supabase
      .from('warehouse_pricing')
      .insert(testData)
      .select()

    if (insertError) {
      console.error('\n❌ Error inserting pallet-monthly:')
      console.error('Code:', insertError.code)
      console.error('Message:', insertError.message)
      console.error('Details:', insertError.details)
      console.error('Hint:', insertError.hint)

      if (insertError.message.includes('enum') || insertError.message.includes('check constraint')) {
        console.log('\n⚠️  The enum might not have been updated correctly.')
        console.log('Please run this SQL manually in Supabase Studio SQL Editor:\n')
        console.log(`ALTER TYPE pricing_type ADD VALUE IF NOT EXISTS 'pallet-monthly';`)
        console.log('\nOr run the migration again.')
      }
    } else {
      console.log('\n✅ Successfully inserted pallet-monthly pricing!')
      console.log('Data:', insertData)

      // Clean up test data
      await supabase
        .from('warehouse_pricing')
        .delete()
        .eq('id', insertData[0].id)
      console.log('✅ Test data cleaned up')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkEnum()
