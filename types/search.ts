/**
 * Search-related type definitions for marketplace
 */

export interface WarehouseSearchParams {
  // Location
  lat?: number
  lng?: number
  radius_km?: number // 10, 25, 50, 100 km
  city?: string
  state?: string
  zipCode?: string

  // Booking type and capacity
  type?: 'pallet' | 'area-rental'
  quantity?: number // pallet count or sq ft
  start_date?: string // ISO date string
  end_date?: string // ISO date string

  // Filters
  warehouse_type?: string[]
  storage_type?: string[]
  temperature_types?: string[]
  amenities?: string[]

  // Pricing
  min_price?: number
  max_price?: number

  // Rating (for future review system)
  min_rating?: number

  // Pagination
  limit?: number
  offset?: number

  // Sorting
  sort_by?: 'price' | 'distance' | 'rating' | 'availability' | 'name'
  sort_order?: 'asc' | 'desc'
}

export interface WarehouseSearchResult {
  id: string
  name: string
  address: string
  city: string
  state?: string
  zipCode: string
  totalSqFt?: number
  totalPalletStorage?: number
  availableSqFt?: number
  availablePalletStorage?: number
  warehouseType?: string
  storageTypes?: string[]
  temperatureTypes?: string[]
  amenities?: string[]
  latitude?: number
  longitude?: number
  photos?: string[]
  rating?: number
  reviewCount?: number
  distance_km?: number // Calculated distance if lat/lng provided
  pricing?: {
    pallet?: {
      basePrice: number
      unit: string
    }
    palletMonthly?: {
      basePrice: number
      unit: string
    }
    areaRental?: {
      basePrice: number
      unit: string
    }
  }
}

export interface WarehouseSearchResponse {
  success: boolean
  data: {
    warehouses: WarehouseSearchResult[]
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  error?: string
}

