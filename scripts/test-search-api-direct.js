const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testSearchAPI() {
  console.log('🧪 Testing warehouse search API query\n')

  const city = 'Bergen County, New Jersey'
  console.log(`📍 Searching for: "${city}"\n`)

  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select(`
        id,
        name,
        address,
        city,
        zip_code,
        total_sq_ft,
        total_pallet_storage,
        available_sq_ft,
        available_pallet_storage,
        warehouse_type,
        storage_type,
        temperature_types,
        amenities,
        latitude,
        longitude,
        photos,
        warehouse_pricing(pricing_type, base_price, unit)
      `)
      .eq('status', true)
      .ilike('city', `%${city}%`)

    if (error) {
      console.error('❌ Query error:', error)
      return
    }

    console.log(`✅ Found ${data.length} warehouse(s)\n`)

    if (data.length > 0) {
      data.forEach((wh, i) => {
        console.log(`${i + 1}. ${wh.name}`)
        console.log(`   City: ${wh.city}`)
        console.log(`   Storage Type: ${wh.storage_type}`)
        console.log(`   Temperature Types: ${JSON.stringify(wh.temperature_types)}`)
        console.log(`   Pricing: ${wh.warehouse_pricing?.length || 0} types`)
        if (wh.warehouse_pricing && wh.warehouse_pricing.length > 0) {
          wh.warehouse_pricing.forEach(p => {
            console.log(`     - ${p.pricing_type}: $${p.base_price} ${p.unit}`)
          })
        }
        console.log('')
      })
    }
  } catch (err) {
    console.error('❌ Error:', err.message)
  }
}

testSearchAPI()
