const https = require('https')

function testSearchAPI(city) {
  return new Promise((resolve, reject) => {
    const encodedCity = encodeURIComponent(city)
    const url = `http://localhost:3000/api/v1/warehouses/public/search?city=${encodedCity}`

    console.log(`\n🔍 Testing search for: "${city}"`)
    console.log(`📡 URL: ${url}\n`)

    const req = https.get(url.replace('https:', 'http:'), (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          console.log(`✅ Success: ${result.data?.warehouses?.length || 0} warehouses found`)
          if (result.data?.warehouses?.length > 0) {
            result.data.warehouses.forEach((w, i) => {
              console.log(`   ${i + 1}. ${w.name} - ${w.city}`)
            })
          }
          resolve(result)
        } catch (error) {
          console.error('❌ Parse error:', error.message)
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message)
      reject(error)
    })
  })
}

async function runTests() {
  console.log('🧪 Testing Warehouse Search API\n')
  console.log('=' .repeat(60))

  const cities = [
    'Menemen, İzmir',
    'İzmir',
    'New York',
    'Bergen County, New Jersey',
    'Toronto, Ontario'
  ]

  for (const city of cities) {
    try {
      await testSearchAPI(city)
    } catch (error) {
      console.log('Test failed for:', city)
    }
    console.log('=' .repeat(60))
  }
}

runTests()
