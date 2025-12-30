const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const { data } = await supabase
    .from('warehouses')
    .select('id, city, latitude, longitude')
    .eq('status', true)

  const noCoords = data.filter(w => !w.latitude || !w.longitude)

  console.log(`📊 Total warehouses: ${data.length}`)
  console.log(`📍 Warehouses with coordinates: ${data.length - noCoords.length}`)
  console.log(`❌ Warehouses without coordinates: ${noCoords.length}`)

  if (noCoords.length > 0) {
    console.log('\nWarehouses without coordinates:')
    noCoords.forEach(w => console.log(`  - ${w.city} (ID: ${w.id})`))
  }
}

check()
