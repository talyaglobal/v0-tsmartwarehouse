/**
 * Generate a short, meaningful booking ID
 * Format: {CITY_CODE}-{DATE_CODE}-{TYPE}-{RANDOM}
 * Example: NY-315-ARE-A3B7
 */

interface GenerateBookingIdParams {
  city: string
  startDate: string
  endDate: string
  type: 'pallet' | 'area-rental'
}

/**
 * Get city code from city name
 * Returns 2-3 letter uppercase code
 */
function getCityCode(city: string): string {
  const cityMap: Record<string, string> = {
    'new york': 'NY',
    'los angeles': 'LA',
    'chicago': 'CHI',
    'houston': 'HOU',
    'phoenix': 'PHX',
    'philadelphia': 'PHL',
    'san antonio': 'SA',
    'san diego': 'SD',
    'dallas': 'DAL',
    'san jose': 'SJ',
    'austin': 'AUS',
    'jacksonville': 'JAX',
    'san francisco': 'SF',
    'columbus': 'COL',
    'fort worth': 'FW',
    'charlotte': 'CLT',
    'detroit': 'DET',
    'el paso': 'EP',
    'seattle': 'SEA',
    'denver': 'DEN',
    'washington': 'DC',
    'memphis': 'MEM',
    'boston': 'BOS',
    'nashville': 'NSH',
    'portland': 'PDX',
    'oklahoma city': 'OKC',
    'las vegas': 'LV',
    'baltimore': 'BAL',
    'milwaukee': 'MIL',
    'albuquerque': 'ABQ',
    'tucson': 'TUC',
    'fresno': 'FRE',
    'sacramento': 'SAC',
    'kansas city': 'KC',
    'mesa': 'MES',
    'atlanta': 'ATL',
    'omaha': 'OMA',
    'colorado springs': 'COS',
    'raleigh': 'RAL',
    'virginia beach': 'VB',
    'miami': 'MIA',
    'oakland': 'OAK',
    'minneapolis': 'MIN',
    'tulsa': 'TUL',
    'cleveland': 'CLE',
    'wichita': 'WIC',
    'arlington': 'ARL',
    'elizabeth': 'ELZ',
    'newark': 'NWK',
    'jersey city': 'JC',
  }

  const normalizedCity = city.toLowerCase().trim()
  return cityMap[normalizedCity] || city.substring(0, 3).toUpperCase().padEnd(3, 'X')
}

/**
 * Generate date code from start and end dates
 * Format: {start_day_of_year}{end_day_of_year}
 * Example: 31 Dec - 5 Feb = 36505 (if Feb 5 is day 36 of next year)
 * Simplified: Use month-day format like 1231-0205 = 1231
 */
function getDateCode(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  // Get day of year for start date (1-365)
  const startYear = start.getFullYear()
  const startOfYear = new Date(startYear, 0, 1)
  const startDayOfYear = Math.floor((start.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  // Get day of year for end date
  const endYear = end.getFullYear()
  const endOfYear = new Date(endYear, 0, 1)
  const endDayOfYear = Math.floor((end.getTime() - endOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  // Combine: start day (3 digits) + end day (2 digits if same year, else 3)
  if (startYear === endYear) {
    // Same year: use start day (3 digits) + end day last 2 digits
    return `${startDayOfYear.toString().padStart(3, '0')}${endDayOfYear.toString().slice(-2)}`
  } else {
    // Different year: use start day (3 digits) + end day (3 digits)
    return `${startDayOfYear.toString().padStart(3, '0')}${endDayOfYear.toString().padStart(3, '0')}`
  }
}

/**
 * Get booking type code
 */
function getTypeCode(type: 'pallet' | 'area-rental'): string {
  return type === 'area-rental' ? 'ARE' : 'PAL'
}

/**
 * Generate random alphanumeric string
 */
function generateRandomCode(length: number = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude confusing chars like 0, O, I, 1
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate a booking ID
 */
export function generateBookingId(params: GenerateBookingIdParams): string {
  const cityCode = getCityCode(params.city)
  const dateCode = getDateCode(params.startDate, params.endDate)
  const typeCode = getTypeCode(params.type)
  const randomCode = generateRandomCode(4)
  
  return `${cityCode}-${dateCode}-${typeCode}-${randomCode}`
}

/**
 * Check if a booking ID already exists
 */
export async function bookingIdExists(id: string): Promise<boolean> {
  const { createServerSupabaseClient } = await import('@/lib/supabase/server')
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('id', id)
    .limit(1)
    .single()
  
  return !error && data !== null
}

/**
 * Generate a unique booking ID (retries if exists)
 */
export async function generateUniqueBookingId(
  params: GenerateBookingIdParams,
  maxRetries: number = 10
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const id = generateBookingId(params)
    const exists = await bookingIdExists(id)
    
    if (!exists) {
      return id
    }
  }
  
  // If all retries failed, append timestamp
  const baseId = generateBookingId(params)
  const timestamp = Date.now().toString().slice(-4)
  return `${baseId.slice(0, -4)}${timestamp}`
}

