/**
 * Utility functions for generating warehouse names
 */

const WAREHOUSE_TYPE_CODES: Record<string, string> = {
  "general-dry-ambient": "GN",
  "food-beverage-fda": "FB",
  "pharmaceutical-fda-cgmp": "PH",
  "medical-devices-fda": "MD",
  "nutraceuticals-supplements-fda": "NT",
  "cosmetics-fda": "CS",
  "hazardous-materials-hazmat": "HM",
  "cold-storage": "CS",
  "alcohol-tobacco-ttb": "AT",
  "consumer-electronics": "CE",
  "automotive-parts": "AP",
  "ecommerce-high-velocity": "EC",
  // Legacy support for old values
  "general": "GN",
  "food-and-beverages": "FB",
  "dangerous-goods": "HM",
  "chemicals": "CH",
  "medical": "MD",
  "pharma": "PH",
}

// US State codes mapping (common states)
const STATE_CODES: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
  "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
  "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
  "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
  "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
  "District of Columbia": "DC",
}

/**
 * Generate a random alphanumeric string of specified length
 */
function generateRandomCode(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Get state code from city and state
 * If state is provided, use it; otherwise, try to extract from city string or use first 2 letters of city
 */
function getStateCode(city: string, state?: string): string {
  if (state) {
    // Check if state is already a code (2 letters)
    if (state.length === 2 && /^[A-Z]{2}$/.test(state.toUpperCase())) {
      return state.toUpperCase()
    }
    // Try to find state code from full state name
    const stateCode = STATE_CODES[state] || STATE_CODES[state.toUpperCase()]
    if (stateCode) {
      return stateCode
    }
  }
  
  // Fallback: use first 2 letters of city (uppercase)
  return city.substring(0, 2).toUpperCase().padEnd(2, "X")
}

/**
 * Generate warehouse name based on location and type
 * Format: STATE_CODE-TYPE_CODE-RANDOM5
 * Example: NY-GN-A3B7K
 */
export function generateWarehouseName(
  city: string,
  warehouseType: string | string[],
  state?: string
): string {
  const stateCode = getStateCode(city, state)
  // Handle both string and array types (for backward compatibility)
  const typeValue = Array.isArray(warehouseType) ? warehouseType[0] : warehouseType
  const typeCode = WAREHOUSE_TYPE_CODES[typeValue] || "GN"
  const randomCode = generateRandomCode(5)
  
  return `${stateCode}-${typeCode}-${randomCode}`
}

