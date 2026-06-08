/**
 * Warehouse Search Service (KolayBase Implementation)
 * 
 * Provides search functionality for warehouses using KolayBase.
 * Handles filtering, sorting, pagination, and availability calculation.
 * Uses PostGIS for geographic search when coordinates are provided.
 * 
 * NOTE: This is the current implementation using KolayBase.
 * Prisma version is available in warehouse-search.ts for future migration.
 */

import { createServerClient } from '@/lib/kolaybase/server'
import type { WarehouseSearchParams, WarehouseSearchResult, SearchResponse } from '@/types/marketplace'
import { getStoragePublicUrls } from '@/lib/utils/storage'

// US State abbreviations mapping
const US_STATES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
}

// Reverse mapping: abbreviation to full name
const US_STATES_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATES).map(([name, abbr]) => [abbr.toLowerCase(), name])
)

/**
 * Get state abbreviation from full name or vice versa
 */
function normalizeStateSearch(searchTerm: string): { abbr: string | null; fullName: string | null } {
  const lower = searchTerm.toLowerCase().trim()
  
  // Check if it's a full state name
  if (US_STATES[lower]) {
    return { abbr: US_STATES[lower], fullName: lower }
  }
  
  // Check if it's a state abbreviation (2 letters)
  if (lower.length === 2 && US_STATES_REVERSE[lower]) {
    return { abbr: lower.toUpperCase(), fullName: US_STATES_REVERSE[lower] }
  }
  
  return { abbr: null, fullName: null }
}

// Distance calculation is handled by PostGIS function

/**
 * Calculate average pallet price per day from pallet pricing data
 * Algorithm:
 * 1. Filter to only day-based pricing (for consistent comparison)
 * 2. Get the first (lowest) height range price from each pricing entry
 * 3. Average across all pallet types (standard, euro, custom) and goods types
 * 4. Round to 2 decimal places
 */
function calculateAveragePalletPrice(palletPricing: any[]): number | undefined {
  if (!palletPricing || palletPricing.length === 0) return undefined

  // Get all day-based pricing entries
  const dayPricing = palletPricing.filter(pp => pp.pricingPeriod === 'day')
  
  if (dayPricing.length === 0) {
    // Fallback to week pricing and convert to daily
    const weekPricing = palletPricing.filter(pp => pp.pricingPeriod === 'week')
    if (weekPricing.length > 0) {
      const prices: number[] = []
      weekPricing.forEach(pp => {
        if (pp.heightRanges && pp.heightRanges.length > 0) {
          // Get the first (typically the lowest/base) height range price
          const basePrice = pp.heightRanges[0].pricePerUnit
          if (basePrice > 0) {
            prices.push(basePrice / 7) // Convert weekly to daily
          }
        }
      })
      if (prices.length > 0) {
        const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length
        return Math.round(avg * 100) / 100
      }
    }
    
    // Fallback to month pricing and convert to daily
    const monthPricing = palletPricing.filter(pp => pp.pricingPeriod === 'month')
    if (monthPricing.length > 0) {
      const prices: number[] = []
      monthPricing.forEach(pp => {
        if (pp.heightRanges && pp.heightRanges.length > 0) {
          const basePrice = pp.heightRanges[0].pricePerUnit
          if (basePrice > 0) {
            prices.push(basePrice / 30) // Convert monthly to daily
          }
        }
      })
      if (prices.length > 0) {
        const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length
        return Math.round(avg * 100) / 100
      }
    }
    
    return undefined
  }

  // Collect all base prices from day pricing
  const prices: number[] = []
  
  dayPricing.forEach(pp => {
    if (pp.heightRanges && pp.heightRanges.length > 0) {
      // Get the first (typically the lowest/base) height range price
      const basePrice = pp.heightRanges[0].pricePerUnit
      if (basePrice > 0) {
        prices.push(basePrice)
      }
    }
  })

  if (prices.length === 0) return undefined

  // Calculate average
  const average = prices.reduce((sum, p) => sum + p, 0) / prices.length
  
  // Round to 2 decimal places
  return Math.round(average * 100) / 100
}

/**
 * Search warehouses with filters, sorting, and pagination
 * Uses PostGIS function when lat/lng provided, otherwise uses regular query
 */
export async function searchWarehouses(
  params: WarehouseSearchParams
): Promise<SearchResponse> {
  const supabase = createServerClient()
  const page = params.page || 1
  const limit = params.limit || 20
  const offset = (page - 1) * limit

  try {
    // If lat/lng provided, use PostGIS function
    if (params.lat && params.lng) {
      const { data, error } = await supabase.rpc('search_warehouses_by_location', {
        search_lat: params.lat,
        search_lng: params.lng,
        radius_km: params.radius_km || 50,
        goods_type_filter: params.goods_type?.length ? params.goods_type : null,
        storage_type_filter: params.storage_type?.length ? params.storage_type : null,
        min_pallet_capacity: params.type === 'pallet' ? params.quantity : null,
        min_area_sqft: params.type === 'area-rental' ? params.quantity : null,
      })

      if (error) {
        console.error('[warehouse-search] PostGIS function error:', error)
        throw error
      }

      // Transform PostGIS results
      let results: WarehouseSearchResult[] = (data || []).map((wh: any) => {
        // Convert photo paths to full URLs
        const photos = wh.photos && Array.isArray(wh.photos) ? getStoragePublicUrls(wh.photos, 'docs') : []
        
        // Get pricing and company info
        return {
          id: wh.id,
          name: wh.name,
          address: wh.address,
          city: wh.city,
          latitude: parseFloat(wh.latitude) || 0,
          longitude: parseFloat(wh.longitude) || 0,
          distance_km: wh.distance_km ? parseFloat(wh.distance_km) : undefined,
          total_sq_ft: wh.total_sq_ft || 0,
          available_sq_ft: wh.available_sq_ft || 0,
          total_pallet_storage: wh.total_pallet_storage || 0,
          available_pallet_storage: wh.available_pallet_storage || 0,
          min_sq_ft: wh.min_sq_ft || undefined,
          max_sq_ft: wh.max_sq_ft || undefined,
          goods_type: wh.goods_type || '',
          storage_type: wh.storage_type || '',
          temperature_types: wh.temperature_types || [],
          amenities: wh.amenities || [],
          description: wh.description || undefined,
          photos: photos,
          min_price: 0, // Will be populated below
          pricing: [],
          average_rating: 0,
          total_reviews: 0,
          external_rating: wh.external_rating ? parseFloat(wh.external_rating) : undefined,
          external_reviews_count: wh.external_reviews_count || undefined,
          external_rating_source: "google_maps",
          company_name: '',
          is_verified: false,
        }
      })

      // Fetch additional data (pricing, reviews, company) for each warehouse
      const warehouseIds = results.map((r) => r.id)
      if (warehouseIds.length > 0) {
        // Get pricing
        const { data: pricingData } = await supabase
          .from('warehouse_pricing')
          .select('warehouse_id, pricing_type, base_price, unit')
          .in('warehouse_id', warehouseIds)
          .eq('status', true)

        // Get review summaries
        const { data: reviewData } = await supabase
          .from('warehouse_review_summary')
          .select('warehouse_id, average_rating, total_reviews')
          .in('warehouse_id', warehouseIds)

        // Get company info, rent_methods, and min/max sq_ft
        const { data: warehouseData } = await supabase
          .from('warehouses')
          .select('id, owner_company_id, rent_methods, min_sq_ft, max_sq_ft, companies(id, short_name, logo_url, verification_status)')
          .in('id', warehouseIds)

        // Merge data
        results = results.map((wh) => {
          const pricing = (pricingData || [])
            .filter((p: any) => p.warehouse_id === wh.id)
            .map((p: any) => ({
              type: p.pricing_type,
              price: parseFloat(p.base_price) || 0,
              unit: p.unit,
            }))

          const minPrice = pricing.length > 0
            ? Math.min(...pricing.map((p) => p.price))
            : 0

          const review = (reviewData || []).find((r: any) => r.warehouse_id === wh.id)
          const warehouse = (warehouseData || []).find((w: any) => w.id === wh.id)
          const company = Array.isArray(warehouse?.companies) ? warehouse.companies[0] : warehouse?.companies

          return {
            ...wh,
            min_price: minPrice,
            pricing,
            rent_methods: warehouse?.rent_methods || [],
            min_sq_ft: warehouse?.min_sq_ft || wh.min_sq_ft || undefined,
            max_sq_ft: warehouse?.max_sq_ft || wh.max_sq_ft || undefined,
            average_rating: review?.average_rating ? parseFloat(review.average_rating) : 0,
            total_reviews: review?.total_reviews || 0,
            company_name: company?.short_name || '',
            company_logo: company?.logo_url || undefined,
            is_verified: company?.verification_status === 'verified',
          }
        })
      }

      // Apply additional filters
      
      // Note: We no longer strictly filter by rent_methods
      // Warehouses are shown based on their capacity (sqft or pallet storage)
      // The type filter is handled by the capacity filters below
      
      if (params.min_rating) {
        results = results.filter((w) => w.average_rating >= params.min_rating!)
      }

      if (params.temperature_types?.length) {
        results = results.filter((w) =>
          params.temperature_types!.some((t) => w.temperature_types.includes(t))
        )
      }

      if (params.amenities?.length) {
        results = results.filter((w) =>
          params.amenities!.some((a) => w.amenities.includes(a))
        )
      }

      // Security filter
      if (params.security?.length) {
        results = results.filter((w) =>
          params.security!.some((s) => w.security?.includes(s))
        )
      }

      if (params.min_price || params.max_price) {
        results = results.filter((w) => {
          if (params.min_price && w.min_price < params.min_price) return false
          if (params.max_price && w.min_price > params.max_price) return false
          return true
        })
      }

      // Filter for area-rental (Space Storage) with min/max sqft logic
      if (params.type === 'area-rental' && params.quantity) {
        const requestedSqFt = params.quantity
        results = results.filter((w: any) => {
          const minSqFt = w.min_sq_ft
          const maxSqFt = w.max_sq_ft
          const totalSqFt = w.total_sq_ft || 0
          
          // If min/max limits are set, check if requested amount is within range
          if (minSqFt != null || maxSqFt != null) {
            const meetsMin = minSqFt == null || requestedSqFt >= minSqFt
            const meetsMax = maxSqFt == null || requestedSqFt <= maxSqFt
            return meetsMin && meetsMax
          }
          
          // If no limits set, warehouse capacity must meet customer's requirements
          return totalSqFt >= requestedSqFt
        })
      }

      // Sorting
      const sortBy = params.sort_by || 'distance'
      const sortOrder = params.sort_order || 'asc'

      if (sortBy === 'distance') {
        results.sort((a, b) => {
          const distA = a.distance_km || Infinity
          const distB = b.distance_km || Infinity
          return sortOrder === 'desc' ? distB - distA : distA - distB
        })
      } else if (sortBy === 'price') {
        results.sort((a, b) => {
          return sortOrder === 'desc' ? b.min_price - a.min_price : a.min_price - b.min_price
        })
      } else if (sortBy === 'rating') {
        results.sort((a, b) => {
          return sortOrder === 'desc' ? b.average_rating - a.average_rating : a.average_rating - b.average_rating
        })
      }

      // Pagination
      const total = results.length
      const paginatedResults = results.slice(offset, offset + limit)

      return {
        warehouses: paginatedResults,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      }
    }

    // Fallback to regular query (city-based or all) - query warehouses table directly
    let query = supabase
      .from('warehouses')
      .select(`
        id,
        name,
        address,
        city,
        zip_code,
        latitude,
        longitude,
        total_sq_ft,
        total_pallet_storage,
        min_sq_ft,
        max_sq_ft,
        goods_type,
        storage_types,
        temperature_types,
        amenities,
        operating_hours,
        description,
        rent_methods,
        owner_company_id
      `, { count: 'exact' })

    // City filter - support "Town, ST", "Town, ST 12345", state names, and zip codes
    if (params.city) {
      const searchTerm = params.city.trim()
      const cityName = searchTerm.split(',')[0].trim()
      const zipMatch = searchTerm.match(/\b\d{5}(?:-\d{4})?\b/)
      
      // Check if user is searching for a state name (e.g., "New Jersey" or "NJ")
      const stateSearch = normalizeStateSearch(searchTerm)
      
      if (zipMatch) {
        // ZIP code search - use ilike for zip_code to handle formats like "07206" or "07206-1234"
        const zipCode = zipMatch[0]
        query = query.or(`city.ilike.%${cityName}%,zip_code.ilike.${zipCode}%,address.ilike.%${zipCode}%`)
      } else if (stateSearch.abbr) {
        // State search - search for state abbreviation in city field (e.g., "Fair Lawn, NJ")
        // Also search in address field for full state names
        query = query.or(`city.ilike.%, ${stateSearch.abbr}%,city.ilike.%, ${stateSearch.abbr} %,address.ilike.%${stateSearch.abbr}%,address.ilike.%${stateSearch.fullName}%`)
      } else {
        // Regular city/town search - also search in address for broader matches
        query = query.or(`city.ilike.%${cityName}%,address.ilike.%${cityName}%`)
      }
    }

    if (params.goods_type?.length) {
      query = query.overlaps('goods_type', params.goods_type)
    }

    if (params.storage_type?.length) {
      query = query.overlaps('storage_type', params.storage_type)
    }

    if (params.type === 'pallet' && params.quantity) {
      query = query.gte('available_pallet_storage', params.quantity)
    }

    // Note: area-rental filtering is done after query to support min/max sqft logic
    // If min_sq_ft/max_sq_ft is set, customer's requested quantity must be within range
    // If not set, warehouse's total_sq_ft must be >= customer's requested quantity

    // Note: We no longer strictly filter by rent_methods here
    // Instead, we check for existence of corresponding pricing
    // This is done after the query to be more flexible
    
    // Sorting
    const sortBy = params.sort_by || 'name'
    const sortOrder = params.sort_order || 'asc'
    const sortColumn = sortBy === 'name' ? 'name' : 'name' // For now, sort by name
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[warehouse-search] KolayBase query error:', error)
      throw error
    }

    // Get warehouse IDs for additional data
    const warehouseIds = (data || []).map((w: any) => w.id)

    // Get pricing data
    let pricingData: any[] = []
    if (warehouseIds.length > 0) {
      const { data: pricing } = await supabase
        .from('warehouse_pricing')
        .select('warehouse_id, pricing_type, base_price, unit')
        .in('warehouse_id', warehouseIds)
      pricingData = pricing || []
    }

    // Get review data from warehouse_reviews table directly
    let reviewData: any[] = []
    if (warehouseIds.length > 0) {
      const { data: reviews } = await supabase
        .from('warehouse_reviews')
        .select('warehouse_id, rating')
        .in('warehouse_id', warehouseIds)
      // Aggregate reviews per warehouse
      const reviewMap = new Map<string, { total: number; sum: number }>()
      for (const r of (reviews || [])) {
        const entry = reviewMap.get(r.warehouse_id) || { total: 0, sum: 0 }
        entry.total++
        entry.sum += r.rating
        reviewMap.set(r.warehouse_id, entry)
      }
      reviewData = Array.from(reviewMap.entries()).map(([wid, v]) => ({
        warehouse_id: wid,
        average_rating: v.sum / v.total,
        total_reviews: v.total,
      }))
    }

    // Get company data separately (REST API doesn't support embedded joins)
    let companyData: any[] = []
    const companyIds = [...new Set((data || []).map((w: any) => w.owner_company_id).filter(Boolean))]
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from('companies')
        .select('id, short_name, logo_url, verification_status')
        .in('id', companyIds)
      companyData = companies || []
    }

    // Transform results
    let warehouses: WarehouseSearchResult[] = (data || []).map((wh: any) => {
      // Convert photo paths to full URLs
      const photos = wh.photos && Array.isArray(wh.photos) ? getStoragePublicUrls(wh.photos, 'docs') : []
      
      // Company info fetched separately (REST API doesn't support embedded joins)
      const company = companyData.find((c: any) => c.id === wh.owner_company_id)

      // Get pricing for this warehouse
      const pricing = pricingData
        .filter((p: any) => p.warehouse_id === wh.id)
        .map((p: any) => ({
          type: p.pricing_type,
          price: parseFloat(p.base_price) || 0,
          unit: p.unit,
        }))
      
      const minPrice = pricing.length > 0
        ? Math.min(...pricing.map((p) => p.price))
        : 0

      // Get review data
      const review = reviewData.find((r: any) => r.warehouse_id === wh.id)

      return {
        id: wh.id,
        name: wh.name,
        address: wh.address,
        city: wh.city,
        state: undefined,
        zipCode: wh.zip_code || '',
        latitude: wh.latitude ? parseFloat(wh.latitude) : 0,
        longitude: wh.longitude ? parseFloat(wh.longitude) : 0,
        total_sq_ft: wh.total_sq_ft || 0,
        available_sq_ft: wh.total_sq_ft || 0,
        total_pallet_storage: wh.total_pallet_storage || 0,
        available_pallet_storage: wh.total_pallet_storage || 0,
        min_sq_ft: wh.min_sq_ft || undefined,
        max_sq_ft: wh.max_sq_ft || undefined,
        goods_type: wh.goods_type || '',
        storage_type: wh.storage_types || '',
        temperature_types: wh.temperature_types || [],
        amenities: wh.amenities || [],
        description: wh.description || undefined,
        photos: [],
        min_price: minPrice,
        pricing: pricing,
        rent_methods: wh.rent_methods || [],
        average_rating: review?.average_rating ? parseFloat(review.average_rating) : 0,
        total_reviews: review?.total_reviews || 0,
        external_rating: undefined,
        external_reviews_count: undefined,
        external_rating_source: undefined,
        company_name: company?.short_name || '',
        company_logo: company?.logo_url || undefined,
        is_verified: company?.verification_status === 'verified',
      }
    })

    // Filter by min_rating if provided (done after fetching since rating is from another table)
    if (params.min_rating) {
      warehouses = warehouses.filter((w) => w.average_rating >= params.min_rating!)
    }

    // Filter for area-rental (Space Storage) with min/max sqft logic
    // If min_sq_ft/max_sq_ft is set, customer's requested quantity must be within range
    // If not set, warehouse's total_sq_ft must be >= customer's requested quantity
    let beforeFilterCount = warehouses.length
    if (params.type === 'area-rental' && params.quantity) {
      const requestedSqFt = params.quantity
      warehouses = warehouses.filter((w: any) => {
        const minSqFt = w.min_sq_ft
        const maxSqFt = w.max_sq_ft
        const totalSqFt = w.total_sq_ft || 0
        
        // If min/max limits are set, check if requested amount is within range
        if (minSqFt != null || maxSqFt != null) {
          const meetsMin = minSqFt == null || requestedSqFt >= minSqFt
          const meetsMax = maxSqFt == null || requestedSqFt <= maxSqFt
          return meetsMin && meetsMax
        }
        
        // If no limits set, warehouse capacity must meet customer's requirements
        return totalSqFt >= requestedSqFt
      })
      
      // Debug logging
      if (warehouses.length === 0 && beforeFilterCount > 0) {
        console.log(`[warehouse-search] Area-rental filter: ${beforeFilterCount} warehouses found, but none meet ${requestedSqFt} sqft requirement`)
      }
    }

    // Return actual filtered count for pagination accuracy
    const actualTotal = params.type === 'area-rental' && params.quantity 
      ? warehouses.length 
      : (count || 0)

    return {
      warehouses,
      total: actualTotal,
      page,
      limit,
      total_pages: Math.ceil(actualTotal / limit),
    }
  } catch (error) {
    console.error('[warehouse-search] Error searching warehouses:', error)
    throw error
  }
}

/**
 * Get a single warehouse by ID with full details
 */
export async function getWarehouseById(id: string): Promise<WarehouseSearchResult | null> {
  try {
    const supabase = createServerClient()

    // Get warehouse basic data — explicit columns (KolayBase REST doesn't support select('*') or embedded joins)
    const WAREHOUSE_COLUMNS = 'id,name,address,city,zip_code,total_sq_ft,amenities,operating_hours,latitude,longitude,storage_types,temperature_types,custom_status,at_capacity_sq_ft,at_capacity_pallet,min_pallet,max_pallet,min_sq_ft,max_sq_ft,rent_methods,security,goods_type,video_url,access_info,product_acceptance_start_time,product_acceptance_end_time,working_days,warehouse_in_fee,warehouse_out_fee,ports,total_pallet_storage,free_storage_rules,description,late_arrival_grace_minutes,late_arrival_penalty_amount,late_arrival_penalty_type,payment_terms_days,owner_company_id,warehouse_type'
    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .select(WAREHOUSE_COLUMNS)
      .eq('id', id)
      .single()

    if (error || !warehouse) {
      return null
    }

    // Fetch related data in parallel
    const [pricingResult, palletPricingResult, reviewsResult, companyResult] = await Promise.all([
      supabase.from('warehouse_pricing').select('pricing_type, base_price, unit, min_quantity, max_quantity, volume_discounts').eq('warehouse_id', id),
      supabase.from('warehouse_pallet_pricing').select('id, pallet_type, pricing_period, goods_type, stackable, stackable_adjustment_type, stackable_adjustment_value, unstackable_adjustment_type, unstackable_adjustment_value, custom_length_cm, custom_width_cm, custom_height_cm').eq('warehouse_id', id),
      supabase.from('warehouse_reviews').select('rating').eq('warehouse_id', id),
      warehouse.owner_company_id
        ? supabase.from('companies').select('id, short_name, logo_url, verification_status').eq('id', warehouse.owner_company_id).single()
        : Promise.resolve({ data: null }),
    ])

    const company = companyResult.data as any

    // Review summary from raw reviews
    const reviews = reviewsResult.data || []
    const reviewSummary = reviews.length > 0
      ? { average_rating: reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length, total_reviews: reviews.length }
      : { average_rating: 0, total_reviews: 0 }

    // Transform pricing
    const pricing = (pricingResult.data || []).map((p: any) => ({
      type: p.pricing_type,
      price: parseFloat(p.base_price),
      unit: p.unit,
    }))

    const minPrice = pricing.length > 0 ? Math.min(...pricing.map((p: any) => p.price)) : 0

    // Transform pallet pricing (height/weight ranges fetched separately if needed)
    const palletPricing = (palletPricingResult.data || []).map((pp: any) => ({
      id: pp.id,
      palletType: pp.pallet_type,
      pricingPeriod: pp.pricing_period,
      goodsType: pp.goods_type || 'general',
      stackable: pp.stackable !== undefined ? pp.stackable : true,
      stackableAdjustmentType: pp.stackable_adjustment_type || 'plus_per_unit',
      stackableAdjustmentValue: pp.stackable_adjustment_value != null ? parseFloat(pp.stackable_adjustment_value.toString()) : 0,
      unstackableAdjustmentType: pp.unstackable_adjustment_type || 'plus_per_unit',
      unstackableAdjustmentValue: pp.unstackable_adjustment_value != null ? parseFloat(pp.unstackable_adjustment_value.toString()) : 0,
      customDimensions: pp.custom_length_cm && pp.custom_width_cm && pp.custom_height_cm
        ? { length: pp.custom_length_cm, width: pp.custom_width_cm, height: pp.custom_height_cm, unit: 'cm' }
        : undefined,
    }))

    const averagePalletPrice = calculateAveragePalletPrice(palletPricing)

    return {
      id: warehouse.id,
      name: warehouse.name,
      address: warehouse.address,
      city: warehouse.city,
      state: undefined,
      zipCode: warehouse.zip_code || '',
      latitude: warehouse.latitude ? parseFloat(warehouse.latitude) : 0,
      longitude: warehouse.longitude ? parseFloat(warehouse.longitude) : 0,
      total_sq_ft: warehouse.total_sq_ft || 0,
      available_sq_ft: warehouse.total_sq_ft || 0,
      total_pallet_storage: warehouse.total_pallet_storage || 0,
      available_pallet_storage: warehouse.total_pallet_storage || 0,
      goods_type: warehouse.goods_type || '',
      storage_type: warehouse.storage_types || '',
      temperature_types: warehouse.temperature_types || [],
      amenities: warehouse.amenities || [],
      description: warehouse.description || undefined,
      photos: [],
      min_price: minPrice,
      average_pallet_price: averagePalletPrice,
      pricing: pricing,
      palletPricing: palletPricing.length > 0 ? palletPricing : undefined,
      external_rating: undefined,
      external_reviews_count: undefined,
      external_rating_source: undefined,
      average_rating: reviewSummary?.average_rating ? parseFloat(reviewSummary.average_rating) : 0,
      total_reviews: reviewSummary?.total_reviews || 0,
      company_name: company?.short_name || '',
      company_logo: company?.logo_url || undefined,
      is_verified: company?.verification_status === 'verified',
      // Additional fields
      custom_status: warehouse.custom_status || undefined,
      min_pallet: warehouse.min_pallet || undefined,
      max_pallet: warehouse.max_pallet || undefined,
      min_sq_ft: warehouse.min_sq_ft || undefined,
      max_sq_ft: warehouse.max_sq_ft || undefined,
      rent_methods: warehouse.rent_methods || [],
      security: warehouse.security || [],
      video_url: warehouse.video_url || undefined,
      videos: [],
      access_info: warehouse.access_info || undefined,
      product_acceptance_start_time: warehouse.product_acceptance_start_time || undefined,
      product_acceptance_end_time: warehouse.product_acceptance_end_time || undefined,
      working_days: warehouse.working_days || [],
      operating_hours: warehouse.operating_hours || undefined,
      warehouse_in_fee: warehouse.warehouse_in_fee != null ? parseFloat(warehouse.warehouse_in_fee.toString()) : undefined,
      warehouse_out_fee: warehouse.warehouse_out_fee != null ? parseFloat(warehouse.warehouse_out_fee.toString()) : undefined,
      ports: warehouse.ports || [],
    } as any
  } catch (error) {
    console.error('[warehouse-search] Error fetching warehouse:', error)
    return null
  }
}

