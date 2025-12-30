const { createClient } = require('@supabase/supabase-js')
const https = require('https')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

if (!googleApiKey) {
  console.error('❌ Missing Google Maps API key in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Forward geocode using Google Maps API
function forwardGeocode(cityName) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cityName)}&key=${googleApiKey}`

    https.get(url, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.status === 'OK' && result.results && result.results[0]) {
            resolve(result.results[0])
          } else {
            reject(new Error(`Geocoding failed: ${result.status}`))
          }
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', (error) => {
      reject(error)
    })
  })
}

// Extract city and state from address components
function extractCityAndState(addressComponents) {
  let cityName = ""
  let stateName = ""

  for (const component of addressComponents) {
    const types = component.types
    if (types.includes("locality") || types.includes("administrative_area_level_2")) {
      cityName = component.long_name
    }
    if (types.includes("administrative_area_level_1")) {
      stateName = component.long_name
    }
  }

  return { cityName, stateName }
}

// Delay function to avoid API rate limits
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function updateWarehouses() {
  try {
    console.log('📦 Fetching warehouses without coordinates...\n')

    // Get warehouses without coordinates
    const { data: warehouses, error } = await supabase
      .from('warehouses')
      .select('id, city, address, latitude, longitude')
      .eq('status', true)
      .or('latitude.is.null,longitude.is.null')

    if (error) {
      throw error
    }

    if (!warehouses || warehouses.length === 0) {
      console.log('✅ All warehouses have coordinates!')
      return
    }

    console.log(`Found ${warehouses.length} warehouses to process\n`)

    let updated = 0
    let failed = 0

    for (let i = 0; i < warehouses.length; i++) {
      const warehouse = warehouses[i]
      const progress = `[${i + 1}/${warehouses.length}]`

      console.log(`${progress} Processing: ${warehouse.city}`)

      try {
        // Use address if available, otherwise use city
        const searchQuery = warehouse.address || warehouse.city

        console.log(`  🔍 Geocoding: ${searchQuery}`)
        const result = await forwardGeocode(searchQuery)

        const location = result.geometry.location
        const { cityName, stateName } = extractCityAndState(result.address_components)

        // Format city as "City, State"
        let newCityName = cityName || warehouse.city
        if (stateName && !newCityName.includes(',')) {
          newCityName = `${newCityName}, ${stateName}`
        }

        console.log(`  📍 Coordinates: ${location.lat}, ${location.lng}`)
        console.log(`  ✏️  City: "${warehouse.city}" → "${newCityName}"`)

        // Update warehouse
        const { error: updateError } = await supabase
          .from('warehouses')
          .update({
            city: newCityName,
            latitude: location.lat,
            longitude: location.lng
          })
          .eq('id', warehouse.id)

        if (updateError) {
          console.log(`  ❌ Update failed: ${updateError.message}`)
          failed++
        } else {
          console.log(`  ✅ Updated successfully`)
          updated++
        }

        // Delay to avoid hitting API rate limits
        await delay(100)

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`)
        failed++
      }

      console.log('')
    }

    console.log('=' .repeat(60))
    console.log('📊 Summary:')
    console.log(`  ✅ Updated: ${updated}`)
    console.log(`  ❌ Failed: ${failed}`)
    console.log(`  📦 Total processed: ${warehouses.length}`)
    console.log('=' .repeat(60))

    if (updated > 0) {
      console.log('\n🎉 Update completed successfully!')
      console.log('Warehouses now have coordinates and properly formatted city names.')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

console.log('🚀 Starting warehouse update...')
console.log('This will add coordinates and format city names\n')

updateWarehouses()
