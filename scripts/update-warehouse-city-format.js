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
  console.error('Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Reverse geocode using Google Maps API
function reverseGeocode(lat, lng) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`

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

async function updateWarehouseCities() {
  try {
    console.log('📦 Fetching warehouses from database...\n')

    // Get all warehouses with coordinates
    const { data: warehouses, error } = await supabase
      .from('warehouses')
      .select('id, city, latitude, longitude')
      .eq('status', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (error) {
      throw error
    }

    if (!warehouses || warehouses.length === 0) {
      console.log('⚠️  No warehouses found with coordinates')
      return
    }

    console.log(`Found ${warehouses.length} warehouses to process\n`)

    let updated = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < warehouses.length; i++) {
      const warehouse = warehouses[i]
      const progress = `[${i + 1}/${warehouses.length}]`

      console.log(`${progress} Processing: ${warehouse.city}`)

      // Skip if already in "City, State" format
      if (warehouse.city && warehouse.city.includes(',')) {
        console.log(`  ⏭️  Already formatted, skipping`)
        skipped++
        continue
      }

      try {
        // Reverse geocode to get full address
        console.log(`  🔍 Geocoding: ${warehouse.latitude}, ${warehouse.longitude}`)
        const result = await reverseGeocode(warehouse.latitude, warehouse.longitude)

        const { cityName, stateName } = extractCityAndState(result.address_components)

        if (!cityName) {
          console.log(`  ⚠️  Could not extract city name, skipping`)
          failed++
          continue
        }

        // Format as "City, State" if state exists
        let newCityName = cityName
        if (stateName) {
          newCityName = `${cityName}, ${stateName}`
        }

        console.log(`  ✏️  Updating: "${warehouse.city}" → "${newCityName}"`)

        // Update warehouse
        const { error: updateError } = await supabase
          .from('warehouses')
          .update({ city: newCityName })
          .eq('id', warehouse.id)

        if (updateError) {
          console.log(`  ❌ Update failed: ${updateError.message}`)
          failed++
        } else {
          console.log(`  ✅ Updated successfully`)
          updated++
        }

        // Delay to avoid hitting API rate limits (40 requests per second for Geocoding API)
        await delay(100) // 100ms delay = max 10 requests/second

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`)
        failed++
      }

      console.log('') // Empty line for readability
    }

    console.log('=' .repeat(60))
    console.log('📊 Summary:')
    console.log(`  ✅ Updated: ${updated}`)
    console.log(`  ⏭️  Skipped (already formatted): ${skipped}`)
    console.log(`  ❌ Failed: ${failed}`)
    console.log(`  📦 Total processed: ${warehouses.length}`)
    console.log('=' .repeat(60))

    if (updated > 0) {
      console.log('\n🎉 City format update completed successfully!')
      console.log('Now warehouses will be searchable by province/state name.')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

console.log('🚀 Starting warehouse city format update...')
console.log('This will update city names to "District, Province" format\n')

updateWarehouseCities()
