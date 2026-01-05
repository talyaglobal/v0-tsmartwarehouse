/**
 * Warehouse Search Service (Supabase Implementation)
 * 
 * Provides search functionality for warehouses using Supabase.
 * Handles filtering, sorting, pagination, and availability calculation.
 * Uses PostGIS for geographic search when coordinates are provided.
 * 
 * NOTE: This is the current implementation using Supabase.
 * Prisma version is available in warehouse-search.ts for future migration.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { WarehouseSearchParams, WarehouseSearchResult, SearchResponse } from '@/types/marketplace'
import { getStoragePublicUrls } from '@/lib/utils/storage'

// Distance calculation is handled by PostGIS function

/**
 * Search warehouses with filters, sorting, and pagination
 * Uses PostGIS function when lat/lng provided, otherwise uses regular query
 */
export async function searchWarehouses(
  params: WarehouseSearchParams
): Promise<SearchResponse> {
  const supabase = createServerSupabaseClient()
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
        warehouse_type_filter: params.warehouse_type?.length ? params.warehouse_type : null,
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
          warehouse_type: wh.warehouse_type || '',
          storage_type: wh.storage_type || '',
          temperature_types: wh.temperature_types || [],
          amenities: wh.amenities || [],
          photos: photos,
          min_price: 0, // Will be populated below
          pricing: [],
          average_rating: 0,
          total_reviews: 0,
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

        // Get company info
        const { data: warehouseData } = await supabase
          .from('warehouses')
          .select('id, owner_company_id, companies(id, name, logo_url, verification_status)')
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
            average_rating: review?.average_rating ? parseFloat(review.average_rating) : 0,
            total_reviews: review?.total_reviews || 0,
            company_name: company?.name || '',
            company_logo: company?.logo_url || undefined,
            is_verified: company?.verification_status === 'verified',
          }
        })
      }

      // Apply additional filters
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

      if (params.min_price || params.max_price) {
        results = results.filter((w) => {
          if (params.min_price && w.min_price < params.min_price) return false
          if (params.max_price && w.min_price > params.max_price) return false
          return true
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

    // Fallback to regular query (city-based or all)
    let query = supabase
      .from('warehouse_listings')
      .select('*', { count: 'exact' })

    if (params.city) {
      query = query.ilike('city', `%${params.city}%`)
    }

    if (params.warehouse_type?.length) {
      query = query.in('warehouse_type', params.warehouse_type)
    }

    if (params.storage_type?.length) {
      query = query.in('storage_type', params.storage_type)
    }

    if (params.min_rating) {
      query = query.gte('average_rating', params.min_rating)
    }

    if (params.type === 'pallet' && params.quantity) {
      query = query.gte('available_pallet_storage', params.quantity)
    }

    if (params.type === 'area-rental' && params.quantity) {
      query = query.gte('available_sq_ft', params.quantity)
    }

    // Sorting
    const sortBy = params.sort_by || 'name'
    const sortOrder = params.sort_order || 'asc'
    const sortColumn =
      sortBy === 'price'
        ? 'min_price'
        : sortBy === 'rating'
        ? 'average_rating'
        : 'name'
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[warehouse-search] Supabase query error:', error)
      throw error
    }

    // Transform results
    const warehouses: WarehouseSearchResult[] = (data || []).map((wh: any) => {
      // Convert photo paths to full URLs
      const photos = wh.photos && Array.isArray(wh.photos) ? getStoragePublicUrls(wh.photos, 'docs') : []
      
      return {
        id: wh.id,
        name: wh.name,
        address: wh.address,
        city: wh.city,
        state: wh.state || undefined,
        zipCode: wh.zip_code || '',
        latitude: wh.latitude ? parseFloat(wh.latitude) : 0,
        longitude: wh.longitude ? parseFloat(wh.longitude) : 0,
        total_sq_ft: wh.total_sq_ft || 0,
        available_sq_ft: wh.available_sq_ft || 0,
        total_pallet_storage: wh.total_pallet_storage || 0,
        available_pallet_storage: wh.available_pallet_storage || 0,
        warehouse_type: wh.warehouse_type || '',
        storage_type: wh.storage_type || '',
        temperature_types: wh.temperature_types || [],
        amenities: wh.amenities || [],
        photos: photos,
        min_price: wh.min_price ? parseFloat(wh.min_price) : 0,
        pricing: wh.pricing || [],
        average_rating: wh.average_rating ? parseFloat(wh.average_rating) : 0,
        total_reviews: wh.total_reviews || 0,
        company_name: wh.company_name || '',
        company_logo: wh.company_logo || undefined,
        is_verified: wh.host_verification === 'verified',
      }
    })

    return {
      warehouses,
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
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
    const supabase = createServerSupabaseClient()

    const { data: warehouse, error } = await supabase
      .from('warehouse_listings')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !warehouse) {
      return null
    }

    return {
      id: warehouse.id,
      name: warehouse.name,
      address: warehouse.address,
      city: warehouse.city,
      state: warehouse.state || undefined,
      zipCode: warehouse.zip_code || '',
      latitude: warehouse.latitude ? parseFloat(warehouse.latitude) : 0,
      longitude: warehouse.longitude ? parseFloat(warehouse.longitude) : 0,
      total_sq_ft: warehouse.total_sq_ft || 0,
      available_sq_ft: warehouse.available_sq_ft || 0,
      total_pallet_storage: warehouse.total_pallet_storage || 0,
      available_pallet_storage: warehouse.available_pallet_storage || 0,
      warehouse_type: warehouse.warehouse_type || '',
      storage_type: warehouse.storage_type || '',
      temperature_types: warehouse.temperature_types || [],
      amenities: warehouse.amenities || [],
      photos: warehouse.photos && Array.isArray(warehouse.photos) ? getStoragePublicUrls(warehouse.photos, 'docs') : [],
      min_price: warehouse.min_price ? parseFloat(warehouse.min_price) : 0,
      pricing: warehouse.pricing || [],
      average_rating: warehouse.average_rating ? parseFloat(warehouse.average_rating) : 0,
      total_reviews: warehouse.total_reviews || 0,
      company_name: warehouse.company_name || '',
      company_logo: warehouse.company_logo || undefined,
      is_verified: warehouse.host_verification === 'verified',
    }
  } catch (error) {
    console.error('[warehouse-search] Error fetching warehouse:', error)
    return null
  }
}

