// Test URL encoding for Turkish characters
const cities = [
  'Menemen, İzmir',
  'İzmir',
  'Lalapaşa, Edirne',
  'Serinhisar, Denizli'
]

console.log('🧪 Testing URL encoding for Turkish characters\n')
console.log('=' .repeat(70))

cities.forEach(city => {
  const encoded = encodeURIComponent(city)
  const decoded = decodeURIComponent(encoded)

  console.log(`\n📍 Original:  ${city}`)
  console.log(`🔐 Encoded:   ${encoded}`)
  console.log(`🔓 Decoded:   ${decoded}`)
  console.log(`✅ Match:     ${city === decoded ? 'YES' : 'NO'}`)
  console.log(`\n🔗 Full URL:  /api/v1/warehouses/public/search?city=${encoded}`)
  console.log('-'.repeat(70))
})

console.log('\n✅ Encoding test complete!')
console.log('\nNote: İ (Turkish capital i with dot) should encode as %C4%B0')
console.log('      If this works correctly, the search API should work too.')
