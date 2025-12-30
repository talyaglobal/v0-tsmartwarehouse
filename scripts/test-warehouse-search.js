const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testSearch(searchTerm) {
  console.log(`\n🔍 Searching for: "${searchTerm}"`)

  const { data, error } = await supabase
    .from('warehouses')
    .select('id, city')
    .eq('status', true)
    .ilike('city', `%${searchTerm}%`)

  if (error) {
    console.log(`  ❌ Error: ${error.message}`)
    return
  }

  if (!data || data.length === 0) {
    console.log(`  ❌ No results found`)
    return
  }

  console.log(`  ✅ Found ${data.length} result(s):`)
  data.forEach(w => {
    console.log(`     - ${w.city}`)
  })
}

async function runTests() {
  console.log('🧪 Testing warehouse search with ILIKE...\n')
  console.log('Database warehouses:')

  const { data: all } = await supabase
    .from('warehouses')
    .select('city')
    .eq('status', true)
    .order('city')

  all.forEach((w, i) => console.log(`  ${i + 1}. ${w.city}`))

  // Test various search terms
  await testSearch('İzmir')
  await testSearch('Menemen')
  await testSearch('New York')
  await testSearch('New Jersey')
  await testSearch('Ontario')
  await testSearch('Toronto')
  await testSearch('Pennsylvania')
  await testSearch('Edirne')
  await testSearch('Denizli')

  console.log('\n✅ Test completed!')
}

runTests()
