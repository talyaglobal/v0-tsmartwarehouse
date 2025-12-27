/**
 * Countries and Cities API Integration
 * Uses REST Countries API for countries and CountryStateCity API for cities
 */

export interface Country {
  code: string
  name: string
}

export interface City {
  name: string
  state?: string // For US cities with states
  countryCode?: string
}

/**
 * Fetch all countries from REST Countries API
 * Free API, no key required
 */
export async function fetchCountries(): Promise<Country[]> {
  try {
    const response = await fetch('https://restcountries.com/v3.1/all?fields=cca2,name')
    if (!response.ok) {
      throw new Error('Failed to fetch countries')
    }
    const data = await response.json()
    
    return data
      .map((country: any) => ({
        code: country.cca2,
        name: country.name.common,
      }))
      .sort((a: Country, b: Country) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('Error fetching countries:', error)
    // Fallback to common countries if API fails
    return [
      { code: 'US', name: 'United States' },
      { code: 'TR', name: 'Türkiye' },
      { code: 'GB', name: 'United Kingdom' },
      { code: 'DE', name: 'Germany' },
      { code: 'FR', name: 'France' },
      { code: 'CA', name: 'Canada' },
      { code: 'AU', name: 'Australia' },
    ]
  }
}

/**
 * Fetch cities for a country
 * Uses GeoNames API (free, requires registration for better rate limits)
 * 
 * For Turkey (TR): Returns only province centers (il merkezleri) using PPLA feature code
 * For other countries: Uses PPL feature code for all populated places
 * 
 * GeoNames feature codes:
 * - PPLA: seat of a first-order administrative division (il merkezleri for Turkey)
 * - PPL: populated place (cities, towns, villages)
 * 
 * Setup instructions:
 * 1. Register at https://www.geonames.org/login (free)
 * 2. Activate your account via email
 * 3. Add GEONAMES_USERNAME=your_username to .env.local
 * 
 * Rate limits:
 * - Without username (demo): Very limited, may fail
 * - With registered username: 1000 requests/hour (free tier)
 */
export async function fetchCitiesByCountry(countryCode: string): Promise<City[]> {
  try {
    // Check for GeoNames username - warn if not set
    const username = process.env.GEONAMES_USERNAME || 'demo'
    
    if (username === 'demo') {
      console.warn(
        'GeoNames API: Using demo username (very limited). ' +
        'Register at https://www.geonames.org/login and set GEONAMES_USERNAME in .env.local for better rate limits.'
      )
    }
    
    // For Turkey, use PPLA (province centers/il merkezleri) instead of PPL (all populated places)
    // PPLA = seat of a first-order administrative division = il merkezleri
    // For other countries, use PPL to get all cities
    const featureCode = countryCode.toUpperCase() === 'TR' ? 'PPLA' : 'PPL'
    
    // GeoNames API endpoint
    // orderby=population sorts by population (most populous first)
    const url = `https://secure.geonames.org/searchJSON?country=${countryCode}&featureCode=${featureCode}&maxRows=1000&orderby=population&username=${username}`
    
    // Create AbortController for timeout (more compatible than AbortSignal.timeout)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      // Handle timeout/abort errors
      if (fetchError.name === 'AbortError' || controller.signal.aborted) {
        console.error(`GeoNames API timeout for country ${countryCode}`)
        throw new Error('Request timed out. Please try again later.')
      }
      throw fetchError
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`GeoNames API returned status ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    
    // Check for GeoNames API errors (API returns 200 OK but with error in status field)
    if (data.status && data.status.message) {
      const errorMsg = data.status.message
      console.error(`GeoNames API error for country ${countryCode}: ${errorMsg}`)
      
      // Check if account is not enabled for webservice
      if (errorMsg.includes('not enabled') || errorMsg.includes('enable it on your account')) {
        const error = new Error(`GeoNames account not enabled. Please enable webservice at https://www.geonames.org/manageaccount`)
        error.name = 'GeoNamesAccountNotEnabledError'
        throw error
      }
      
      // Check if it's a rate limit error (demo account limit exceeded)
      if (errorMsg.includes('daily limit') || errorMsg.includes('limit') || errorMsg.includes('exceeded') || errorMsg.includes('demo')) {
        const error = new Error(`GeoNames API rate limit exceeded. Please register at https://www.geonames.org/login and set GEONAMES_USERNAME in .env.local`)
        error.name = 'GeoNamesRateLimitError'
        throw error
      }
      
      throw new Error(`GeoNames API error: ${errorMsg}`)
    }
    
    if (!data.geonames || data.geonames.length === 0) {
      console.warn(`No cities found for country ${countryCode} via GeoNames API`)
      return []
    }

    // Extract unique city names, group by name and state to handle duplicates
    const cityMap = new Map<string, City>()
    
    data.geonames.forEach((city: any) => {
      const cityName = city.name
      const adminCode = city.adminCode1 // State/province code (e.g., "CA" for California)
      const adminName = city.adminName1 // State/province name (e.g., "California")
      
      // Prefer admin code (shorter) over admin name, use name if code not available
      const state = adminCode || adminName || undefined
      
      // Create unique key combining city name and state (if available)
      const cityKey = state ? `${cityName}_${state}` : cityName
      
      // Only add if we don't have this exact combination already
      if (!cityMap.has(cityKey)) {
        cityMap.set(cityKey, {
          name: cityName,
          state: state,
          countryCode: countryCode,
        })
      } else {
        // If city exists but doesn't have state, update it if we found one
        const existing = cityMap.get(cityKey)!
        if (!existing.state && state) {
          existing.state = state
        }
      }
    })

    const cities = Array.from(cityMap.values())
    
    // Sort cities alphabetically by name, then by state if available
    return cities.sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name)
      if (nameCompare !== 0) return nameCompare
      
      // If names are equal, sort by state
      if (a.state && b.state) {
        return a.state.localeCompare(b.state)
      }
      if (a.state) return -1
      if (b.state) return 1
      return 0
    })
  } catch (error: any) {
    // Re-throw account not enabled errors
    if (error.name === 'GeoNamesAccountNotEnabledError') {
      throw error
    }
    
    // Re-throw rate limit errors so they can be handled by the API route
    if (error.name === 'GeoNamesRateLimitError' || 
        (error.message && (error.message.includes('rate limit') || error.message.includes('limit exceeded')))) {
      throw error
    }
    
    // Handle timeout errors
    if (error.message && error.message.includes('timed out')) {
      console.error(`GeoNames API timeout for country ${countryCode}`)
      return [] // Return empty array on timeout
    }
    
    // Handle other errors - log but don't throw to avoid breaking the UI
    console.error(`Error fetching cities for country ${countryCode}:`, error)
    
    // Return empty array if API fails - caller can handle empty result
    return []
  }
}


/**
 * Search cities by name (case-insensitive)
 */
export function searchCities(cities: City[], searchTerm: string): City[] {
  if (!searchTerm) return cities
  
  const lowerSearch = searchTerm.toLowerCase()
  return cities.filter(city => 
    city.name.toLowerCase().includes(lowerSearch) ||
    (city.state && city.state.toLowerCase().includes(lowerSearch))
  )
}

/**
 * Get country by code
 */
export async function getCountryByCode(countryCode: string): Promise<Country | undefined> {
  const countries = await fetchCountries()
  return countries.find(c => c.code === countryCode)
}

