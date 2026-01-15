/**
 * Warehouse Search Service (Prisma Implementation)
 * 
 * Provides search functionality for warehouses using Prisma.
 * Handles filtering, sorting, pagination, and availability calculation.
 * 
 * NOTE: This is the Prisma version for future migration.
 * Current implementation uses Supabase (warehouse-search-supabase.ts).
 * 
 * To use this version:
 * 1. Set up DATABASE_URL in .env.local
 * 2. Run: npm run prisma:setup
 * 3. Update imports to use this file instead of warehouse-search-supabase.ts
 */

// import { prisma } from '@/lib/prisma/client'
// Note: Prisma is not currently in use - this file is for future migration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const prisma: any = null
import type { WarehouseSearchParams, WarehouseSearchResult } from '@/types/search'

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Build Prisma where clause from search parameters
 */
function buildWhereClause(params: WarehouseSearchParams): any {
  const where: any = {
    status: true, // Only active warehouses
  }

  // City filter
  if (params.city) {
    const cityName = params.city.split(',')[0].trim()
    where.city = {
      contains: cityName,
      mode: 'insensitive',
    }
  }

  // State filter
  if (params.state) {
    where.state = params.state
  }

  // Zip code filter
  if (params.zipCode) {
    where.zipCode = params.zipCode
  }

  // Warehouse type filter
  if (params.warehouse_type && params.warehouse_type.length > 0) {
    where.warehouseType = {
      in: params.warehouse_type,
    }
  }

  // Storage type filter
  if (params.storage_type && params.storage_type.length > 0) {
    where.storageType = {
      in: params.storage_type,
    }
  }

  // Temperature types filter (array contains)
  if (params.temperature_types && params.temperature_types.length > 0) {
    where.temperatureTypes = {
      hasSome: params.temperature_types,
    }
  }

  // Amenities filter (array contains any)
  if (params.amenities && params.amenities.length > 0) {
    where.amenities = {
      hasSome: params.amenities,
    }
  }

  // Capacity filters
  if (params.type === 'pallet' && params.quantity) {
    where.availablePalletStorage = {
      gte: params.quantity,
    }
  }

  if (params.type === 'area-rental' && params.quantity) {
    where.availableSqFt = {
      gte: params.quantity,
    }
  }

  // Geographic radius filter (basic implementation)
  // Note: For production, use PostGIS for efficient spatial queries
  if (params.lat && params.lng && params.radius_km) {
    // This is a basic filter - in production, use PostGIS ST_DWithin
    // For now, we'll filter in memory after fetching
    where.latitude = { not: null }
    where.longitude = { not: null }
  }

  return where
}

/**
 * Build order by clause from search parameters
 */
function buildOrderBy(params: WarehouseSearchParams): any {
  const sortBy = params.sort_by || 'name'
  const sortOrder = params.sort_order || 'asc'

  switch (sortBy) {
    case 'price':
      // Order by pricing - would need to join with warehouse_pricing
      return { name: sortOrder }
    case 'distance':
      // Distance sorting handled in memory after geographic filter
      return { name: 'asc' }
    case 'rating':
      // Rating sorting - for future review system
      return { name: sortOrder }
    case 'availability':
      // Sort by available capacity
      if (params.type === 'pallet') {
        return { availablePalletStorage: sortOrder === 'asc' ? 'desc' : 'asc' }
      }
      return { availableSqFt: sortOrder === 'asc' ? 'desc' : 'asc' }
    case 'name':
    default:
      return { name: sortOrder }
  }
}

/**
 * Search warehouses with filters, sorting, and pagination
 */
export async function searchWarehouses(
  params: WarehouseSearchParams
): Promise<{
  warehouses: WarehouseSearchResult[]
  total: number
  hasMore: boolean
}> {
  const limit = params.limit || 50
  const offset = params.offset || 0

  // Build where clause
  const where = buildWhereClause(params)

  // Build order by
  const orderBy = buildOrderBy(params)

  try {
    // Fetch warehouses with pricing
    // Note: This assumes Prisma schema has been generated
    // For now, we'll use a type-safe approach that will work once schema is generated
    const warehouses = await (prisma as any).warehouses.findMany({
      where,
      orderBy,
      take: limit + 1, // Fetch one extra to check if there's more
      skip: offset,
      include: {
        warehouse_pricing: true,
      },
    })

    // Check if there are more results
    const hasMore = warehouses.length > limit
    const results = hasMore ? warehouses.slice(0, limit) : warehouses

    // Get total count (commented out - not used in current implementation)
    // const total = await (prisma as any).warehouses.count({ where })

    // Transform results
    let transformedWarehouses = results.map((wh: any) => {
      const pricingData = wh.warehouse_pricing || []
      const pricing: any = {}

      pricingData.forEach((p: any) => {
        if (p.pricing_type === 'pallet') {
          pricing.pallet = {
            basePrice: parseFloat(p.base_price),
            unit: p.unit,
          }
        } else if (p.pricing_type === 'pallet-monthly') {
          pricing.palletMonthly = {
            basePrice: parseFloat(p.base_price),
            unit: p.unit,
          }
        } else if (p.pricing_type === 'area' || p.pricing_type === 'area-rental') {
          pricing.areaRental = {
            basePrice: parseFloat(p.base_price),
            unit: p.unit,
          }
        }
      })

      const result: WarehouseSearchResult = {
        id: wh.id,
        name: wh.name,
        address: wh.address,
        city: wh.city,
        state: wh.state || undefined,
        zipCode: wh.zip_code,
        totalSqFt: wh.total_sq_ft,
        totalPalletStorage: wh.total_pallet_storage,
        availableSqFt: wh.available_sq_ft,
        availablePalletStorage: wh.available_pallet_storage,
        warehouseType: wh.warehouse_type,
        storageTypes: wh.storage_type ? [wh.storage_type] : [],
        temperatureTypes: wh.temperature_types || [],
        amenities: wh.amenities || [],
        description: wh.description || undefined,
        latitude: wh.latitude ? parseFloat(wh.latitude) : undefined,
        longitude: wh.longitude ? parseFloat(wh.longitude) : undefined,
        photos: wh.photos || [],
        pricing: Object.keys(pricing).length > 0 ? pricing : undefined,
      }

      // Calculate distance if coordinates provided
      if (params.lat && params.lng && result.latitude && result.longitude) {
        result.distance_km = calculateDistance(
          params.lat,
          params.lng,
          result.latitude,
          result.longitude
        )
      }

      return result
    })

    // Apply geographic radius filter if needed
    if (params.lat && params.lng && params.radius_km) {
      transformedWarehouses = transformedWarehouses.filter((wh: WarehouseSearchResult) => {
        if (!wh.distance_km) return false
        return wh.distance_km <= params.radius_km!
      })

      // Re-sort by distance if distance sorting was requested
      if (params.sort_by === 'distance') {
        transformedWarehouses.sort((a: WarehouseSearchResult, b: WarehouseSearchResult) => {
          const distA = a.distance_km || Infinity
          const distB = b.distance_km || Infinity
          return params.sort_order === 'desc' ? distB - distA : distA - distB
        })
      }
    }

    // Apply price filters
    if (params.min_price || params.max_price) {
      transformedWarehouses = transformedWarehouses.filter((wh: WarehouseSearchResult) => {
        if (!wh.pricing) return false

        let price: number | undefined

        if (params.type === 'pallet' && wh.pricing.pallet) {
          price = wh.pricing.pallet.basePrice
        } else if (params.type === 'area-rental' && wh.pricing.areaRental) {
          price = wh.pricing.areaRental.basePrice
        }

        if (price === undefined) return false

        if (params.min_price && price < params.min_price) return false
        if (params.max_price && price > params.max_price) return false

        return true
      })
    }

    return {
      warehouses: transformedWarehouses,
      total: transformedWarehouses.length, // Adjusted total after filters
      hasMore,
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
    const warehouse = await (prisma as any).warehouses.findUnique({
      where: { id },
      include: {
        warehouse_pricing: true,
      },
    })

    if (!warehouse) return null

    // Transform similar to search results
    const pricingData = warehouse.warehouse_pricing || []
    const pricing: any = {}

    pricingData.forEach((p: any) => {
      if (p.pricing_type === 'pallet') {
        pricing.pallet = {
          basePrice: parseFloat(p.base_price),
          unit: p.unit,
        }
      } else if (p.pricing_type === 'pallet-monthly') {
        pricing.palletMonthly = {
          basePrice: parseFloat(p.base_price),
          unit: p.unit,
        }
      } else if (p.pricing_type === 'area' || p.pricing_type === 'area-rental') {
        pricing.areaRental = {
          basePrice: parseFloat(p.base_price),
          unit: p.unit,
        }
      }
    })

    return {
      id: warehouse.id,
      name: warehouse.name,
      address: warehouse.address,
      city: warehouse.city,
      state: warehouse.state || undefined,
      zipCode: warehouse.zip_code,
      totalSqFt: warehouse.total_sq_ft,
      totalPalletStorage: warehouse.total_pallet_storage,
      availableSqFt: warehouse.available_sq_ft,
      availablePalletStorage: warehouse.available_pallet_storage,
      warehouseType: warehouse.warehouse_type,
      storageTypes: warehouse.storage_type ? [warehouse.storage_type] : [],
      temperatureTypes: warehouse.temperature_types || [],
      amenities: warehouse.amenities || [],
      description: warehouse.description || undefined,
      latitude: warehouse.latitude ? parseFloat(warehouse.latitude) : undefined,
      longitude: warehouse.longitude ? parseFloat(warehouse.longitude) : undefined,
      photos: warehouse.photos || [],
      pricing: Object.keys(pricing).length > 0 ? pricing : undefined,
    }
  } catch (error) {
    console.error('[warehouse-search] Error fetching warehouse:', error)
    return null
  }
}

