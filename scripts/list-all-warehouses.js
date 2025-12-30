const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function listWarehouses() {
  const { data } = await supabase
    .from('warehouses')
    .select('id, city, latitude, longitude')
    .eq('status', true)
    .order('city')

  console.log('📦 All Active Warehouses:\n')
  data.forEach((w, i) => {
    const coords = w.latitude && w.longitude ? `✅ (${w.latitude}, ${w.longitude})` : '❌ No coords'
    console.log(`${i + 1}. ${w.city.padEnd(40)} ${coords}`)
  })

  console.log(`\n📊 Total: ${data.length} warehouses`)
}

listWarehouses()
