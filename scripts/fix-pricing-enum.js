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

async function fixEnum() {
  try {
    console.log('Fixing pricing_type enum and constraint...\n')

    // Step 1: Drop the check constraint
    console.log('1. Dropping existing check constraint...')
    const dropConstraint = `
      ALTER TABLE warehouse_pricing
      DROP CONSTRAINT IF EXISTS warehouse_pricing_pricing_type_check;
    `

    const { error: dropError } = await supabase.rpc('exec_raw_sql', { sql: dropConstraint })
    if (dropError) {
      console.log('Note:', dropError.message)
    } else {
      console.log('✅ Constraint dropped')
    }

    // Step 2: Update the constraint to include pallet-monthly
    console.log('\n2. Adding new constraint with pallet-monthly...')
    const addConstraint = `
      ALTER TABLE warehouse_pricing
      ADD CONSTRAINT warehouse_pricing_pricing_type_check
      CHECK (pricing_type IN ('pallet', 'pallet-monthly', 'area', 'area-rental'));
    `

    const { error: addError } = await supabase.rpc('exec_raw_sql', { sql: addConstraint })
    if (addError) {
      console.log('Note:', addError.message)
    } else {
      console.log('✅ New constraint added')
    }

    // Step 3: Verify by trying to insert
    console.log('\n3. Testing insertion with pallet-monthly...')

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

    const { data: insertData, error: insertError } = await supabase
      .from('warehouse_pricing')
      .insert(testData)
      .select()

    if (insertError) {
      console.error('\n❌ Still getting error:', insertError.message)
      console.log('\n🔧 Please run this SQL manually in Supabase Studio:')
      console.log('---')
      console.log(dropConstraint)
      console.log(addConstraint)
      console.log('---')
    } else {
      console.log('\n✅ SUCCESS! pallet-monthly pricing can now be saved!')
      console.log('Test data:', insertData)

      // Clean up
      await supabase
        .from('warehouse_pricing')
        .delete()
        .eq('id', insertData[0].id)
      console.log('✅ Test data cleaned up')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.log('\n🔧 Manual fix required. Run this SQL in Supabase Studio SQL Editor:')
    console.log('---')
    console.log(`
-- Drop old constraint
ALTER TABLE warehouse_pricing
DROP CONSTRAINT IF EXISTS warehouse_pricing_pricing_type_check;

-- Add new constraint with pallet-monthly
ALTER TABLE warehouse_pricing
ADD CONSTRAINT warehouse_pricing_pricing_type_check
CHECK (pricing_type IN ('pallet', 'pallet-monthly', 'area', 'area-rental'));
    `)
    console.log('---')
  }
}

fixEnum()
