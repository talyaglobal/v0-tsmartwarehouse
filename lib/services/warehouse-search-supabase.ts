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
        available_sq_ft,
        total_pallet_storage,
        available_pallet_storage,
        warehouse_type,
        storage_type,
        temperature_types,
        amenities,
        photos,
        operating_hours,
        external_rating,
        external_reviews_count,
        external_rating_source,
        owner_company_id,
        companies(id, name, logo_url, verification_status)
      `, { count: 'exact' })
      .eq('status', true)

    // City filter - support "Town, ST" and "Town, ST 12345" formats
    if (params.city) {
      const cityName = params.city.split(',')[0].trim()
      const zipMatch = params.city.match(/\b\d{5}(?:-\d{4})?\b/)
      if (zipMatch) {
        const zipCode = zipMatch[0]
        query = query.or(`city.ilike.%${cityName}%,zip_code.eq.${zipCode}`)
      } else {
        query = query.ilike('city', `%${cityName}%`)
      }
    }

    if (params.warehouse_type?.length) {
      query = query.overlaps('warehouse_type', params.warehouse_type)
    }

    if (params.storage_type?.length) {
      query = query.overlaps('storage_type', params.storage_type)
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
    const sortColumn = sortBy === 'name' ? 'name' : 'name' // For now, sort by name
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[warehouse-search] Supabase query error:', error)
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
        .eq('status', true)
      pricingData = pricing || []
    }

    // Get review summaries
    let reviewData: any[] = []
    if (warehouseIds.length > 0) {
      const { data: reviews } = await supabase
        .from('warehouse_review_summary')
        .select('warehouse_id, average_rating, total_reviews')
        .in('warehouse_id', warehouseIds)
      reviewData = reviews || []
    }

    // Transform results
    let warehouses: WarehouseSearchResult[] = (data || []).map((wh: any) => {
      // Convert photo paths to full URLs
      const photos = wh.photos && Array.isArray(wh.photos) ? getStoragePublicUrls(wh.photos, 'docs') : []
      
      // Get company info
      const company = Array.isArray(wh.companies) ? wh.companies[0] : wh.companies

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
        state: undefined, // state column doesn't exist in warehouses table
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
        description: wh.description || undefined,
        photos: photos,
        min_price: minPrice,
        pricing: pricing,
        average_rating: review?.average_rating ? parseFloat(review.average_rating) : 0,
        total_reviews: review?.total_reviews || 0,
        external_rating: wh.external_rating != null ? parseFloat(wh.external_rating) : undefined,
        external_reviews_count: wh.external_reviews_count || undefined,
        external_rating_source: wh.external_rating_source || undefined,
        company_name: company?.name || '',
        company_logo: company?.logo_url || undefined,
        is_verified: company?.verification_status === 'verified',
      }
    })

    // Filter by min_rating if provided (done after fetching since rating is from another table)
    if (params.min_rating) {
      warehouses = warehouses.filter((w) => w.average_rating >= params.min_rating!)
    }

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

    // Get warehouse with all fields from warehouses table
    const { data: warehouse, error } = await supabase
      .from('warehouses')
      .select(`
        *,
        companies(id, name, logo_url, verification_status),
        warehouse_pricing(pricing_type, base_price, unit, min_quantity, max_quantity, volume_discounts),
        warehouse_pallet_pricing(
          id,
          pallet_type,
          pricing_period,
          goods_type,
          stackable,
          stackable_adjustment_type,
          stackable_adjustment_value,
          unstackable_adjustment_type,
          unstackable_adjustment_value,
          custom_length_cm,
          custom_width_cm,
          custom_height_cm,
          warehouse_pallet_height_pricing(id, height_min_cm, height_max_cm, price_per_unit),
        warehouse_pallet_weight_pricing(id, weight_min_kg, weight_max_kg, price_per_pallet)
        )
      `)
      .eq('id', id)
      .eq('status', true)
      .single()

    if (error || !warehouse) {
      return null
    }

    // Get review summary
    const { data: reviewSummary } = await supabase
      .from('warehouse_review_summary')
      .select('average_rating, total_reviews')
      .eq('warehouse_id', id)
      .single()

    // Get company info
    const company = Array.isArray(warehouse.companies) ? warehouse.companies[0] as any : warehouse.companies as any

    // Transform pricing
    const pricing = (warehouse.warehouse_pricing || []).map((p: any) => ({
      type: p.pricing_type,
      price: parseFloat(p.base_price),
      unit: p.unit,
    }))

    // Get min price
    const minPrice = pricing.length > 0 ? Math.min(...pricing.map((p: any) => p.price)) : 0

    const palletPricing = (warehouse.warehouse_pallet_pricing || []).map((pp: any) => {
      const heightRanges = (pp.warehouse_pallet_height_pricing || []).map((hp: any) => ({
        id: hp.id,
        heightMinCm: hp.height_min_cm,
        heightMaxCm: hp.height_max_cm,
        pricePerUnit: parseFloat(hp.price_per_unit.toString()),
      }))
      const weightRanges = (pp.warehouse_pallet_weight_pricing || []).map((wp: any) => ({
        id: wp.id,
        weightMinKg: parseFloat(wp.weight_min_kg.toString()),
        weightMaxKg: parseFloat(wp.weight_max_kg.toString()),
        pricePerPallet: parseFloat(wp.price_per_pallet.toString()),
      }))

      return {
        id: pp.id,
        palletType: pp.pallet_type,
        pricingPeriod: pp.pricing_period,
        goodsType: pp.goods_type || 'general',
        stackable: pp.stackable !== undefined ? pp.stackable : true,
        stackableAdjustmentType: pp.stackable_adjustment_type || 'plus_per_unit',
        stackableAdjustmentValue:
          pp.stackable_adjustment_value != null
            ? parseFloat(pp.stackable_adjustment_value.toString())
            : 0,
        unstackableAdjustmentType: pp.unstackable_adjustment_type || 'plus_per_unit',
        unstackableAdjustmentValue:
          pp.unstackable_adjustment_value != null
            ? parseFloat(pp.unstackable_adjustment_value.toString())
            : 0,
        customDimensions:
          pp.custom_length_cm && pp.custom_width_cm && pp.custom_height_cm
            ? {
                length: pp.custom_length_cm,
                width: pp.custom_width_cm,
                height: pp.custom_height_cm,
                unit: 'cm',
              }
            : undefined,
        heightRanges: heightRanges.length > 0 ? heightRanges : undefined,
        weightRanges: weightRanges.length > 0 ? weightRanges : undefined,
      }
    })

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
      description: warehouse.description || undefined,
      photos: warehouse.photos && Array.isArray(warehouse.photos) ? getStoragePublicUrls(warehouse.photos, 'docs') : [],
      min_price: minPrice,
      pricing: pricing,
      palletPricing: palletPricing.length > 0 ? palletPricing : undefined,
      external_rating: warehouse.external_rating != null ? parseFloat(warehouse.external_rating) : undefined,
      external_reviews_count: warehouse.external_reviews_count || undefined,
      external_rating_source: warehouse.external_rating_source || undefined,
      average_rating: reviewSummary?.average_rating ? parseFloat(reviewSummary.average_rating) : 0,
      total_reviews: reviewSummary?.total_reviews || 0,
      company_name: company?.name || '',
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
      video_url: warehouse.video_url ? getStoragePublicUrls([warehouse.video_url], 'docs')[0] : undefined,
      videos: warehouse.videos && Array.isArray(warehouse.videos) ? getStoragePublicUrls(warehouse.videos, 'docs') : [],
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

