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
 * Uses GeoNames API (free, no key required for basic usage)
 * Limited to 1000 requests/hour per IP
 * 
 * For better rate limits, you can register at geonames.org and use a username
 * Then set GEONAMES_USERNAME environment variable
 */
export async function fetchCitiesByCountry(countryCode: string): Promise<City[]> {
  try {
    // Use environment variable if available, otherwise use 'demo' (limited)
    const username = process.env.GEONAMES_USERNAME || 'demo'
    
    // Fetch major cities (PPLC = capital, PPLA = admin division, PPL = populated place)
    const response = await fetch(
      `https://secure.geonames.org/searchJSON?country=${countryCode}&featureCode=PPL&featureCode=PPLC&featureCode=PPLA&maxRows=1000&orderby=population&username=${username}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch cities')
    }

    const data = await response.json()
    
    if (!data.geonames || data.geonames.length === 0) {
      // Fallback: return empty array or common cities for major countries
      return getFallbackCities(countryCode)
    }

    // Extract unique city names, group by name to handle duplicates
    const cityMap = new Map<string, City>()
    
    data.geonames.forEach((city: any) => {
      const cityName = city.name
      const adminCode = city.adminCode1 // State/province code
      const adminName = city.adminName1 // State/province name
      
      // Use admin code if available, otherwise admin name
      const state = adminCode || adminName || undefined
      
      if (!cityMap.has(cityName)) {
        cityMap.set(cityName, {
          name: cityName,
          state: state,
          countryCode: countryCode,
        })
      } else {
        // If city exists but doesn't have state, update it if we found one
        const existing = cityMap.get(cityName)!
        if (!existing.state && state) {
          existing.state = state
        }
      }
    })

    const cities = Array.from(cityMap.values())
    
    // Sort cities alphabetically
    return cities.sort((a, b) => {
      if (a.name < b.name) return -1
      if (a.name > b.name) return 1
      return 0
    })
  } catch (error) {
    console.error(`Error fetching cities for country ${countryCode}:`, error)
    // Return fallback cities if API fails
    return getFallbackCities(countryCode)
  }
}

/**
 * Fallback cities for major countries if API fails
 */
function getFallbackCities(countryCode: string): City[] {
  const fallbackCities: Record<string, City[]> = {
    US: [
      { name: 'New York', state: 'NY' },
      { name: 'Los Angeles', state: 'CA' },
      { name: 'Chicago', state: 'IL' },
      { name: 'Houston', state: 'TX' },
      { name: 'Phoenix', state: 'AZ' },
      { name: 'Philadelphia', state: 'PA' },
      { name: 'San Antonio', state: 'TX' },
      { name: 'San Diego', state: 'CA' },
      { name: 'Dallas', state: 'TX' },
      { name: 'San Jose', state: 'CA' },
    ],
    TR: [
      { name: 'İstanbul' },
      { name: 'Ankara' },
      { name: 'İzmir' },
      { name: 'Bursa' },
      { name: 'Antalya' },
      { name: 'Adana' },
      { name: 'Konya' },
      { name: 'Gaziantep' },
    ],
  }
  
  return fallbackCities[countryCode] || []
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

