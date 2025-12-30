import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"

interface PublicWarehouseSearchResult {
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
  pricing?: {
    pallet?: {
      basePrice: number
      unit: string
    }
    areaRental?: {
      basePrice: number
      unit: string
    }
  }
}

/**
 * GET /api/v1/warehouses/public/search
 * Public endpoint to search warehouses by city (no authentication required)
 * Returns basic warehouse information for location search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get("q") || ""
    const city = searchParams.get("city") || ""

    const supabase = createServerSupabaseClient()

    // Build query - search by city or name/address if search query provided
    // Note: Service role key bypasses RLS, so we can query warehouses without authentication
            let query = supabase
              .from("warehouses")
              .select(`
                id,
                name,
                address,
                city,
                zip_code,
                total_sq_ft,
                total_pallet_storage,
                available_sq_ft,
                available_pallet_storage,
                warehouse_type,
                storage_type,
                temperature_types,
                amenities,
                latitude,
                longitude,
                photos,
                warehouse_pricing(pricing_type, base_price, unit)
              `)
              .eq("status", true) // Only active warehouses (status is BOOLEAN DEFAULT true NOT NULL)

    if (city) {
      // City match - partial match (ilike is case-insensitive)
      // This handles cases like "Fair Lawn" matching "Fair Lawn, NJ"
      query = query.ilike("city", `%${city}%`)
    } else if (searchQuery) {
      // Search in name, city, or address
      query = query.or(
        `name.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`
      )
    }

    // If no city or searchQuery, return all active warehouses (limited)
    // Limit results to 50 for performance
    query = query.limit(50).order("city", { ascending: true })
    
    console.log(`[warehouses/public/search] Query params: city="${city}", searchQuery="${searchQuery}"`)

    const { data, error } = await query

    if (error) {
      console.error("[warehouses/public/search] Query error:", error)
      throw new Error(`Failed to fetch warehouses: ${error.message}`)
    }

    console.log(`[warehouses/public/search] Found ${data?.length || 0} warehouses for city: "${city}"`)
    if (data && data.length > 0) {
      console.log(`[warehouses/public/search] Sample warehouse:`, data[0])
    }

    // Transform results to match PublicWarehouseSearchResult interface
    const results: PublicWarehouseSearchResult[] = (data || []).map((row: any) => {
      // Transform pricing data
      const pricingData = row.warehouse_pricing || []
      const pricing: any = {}

      pricingData.forEach((p: any) => {
        if (p.pricing_type === 'pallet') {
          pricing.pallet = {
            basePrice: p.base_price,
            unit: p.unit
          }
        } else if (p.pricing_type === 'pallet-monthly') {
          pricing.palletMonthly = {
            basePrice: p.base_price,
            unit: p.unit
          }
        } else if (p.pricing_type === 'area' || p.pricing_type === 'area-rental') {
          pricing.areaRental = {
            basePrice: p.base_price,
            unit: p.unit
          }
        }
      })

      return {
        id: row.id,
        name: row.name,
        address: row.address,
        city: row.city,
        state: undefined, // State column doesn't exist in warehouses table
        zipCode: row.zip_code,
        totalSqFt: row.total_sq_ft,
        totalPalletStorage: row.total_pallet_storage,
        availableSqFt: row.available_sq_ft,
        availablePalletStorage: row.available_pallet_storage,
        amenities: row.amenities || [],
        latitude: row.latitude ? parseFloat(row.latitude) : undefined,
        longitude: row.longitude ? parseFloat(row.longitude) : undefined,
        warehouseType: row.warehouse_type,
        storageTypes: row.storage_type ? [row.storage_type] : [], // Convert single value to array
        temperatureTypes: row.temperature_types || [], // Already an array
        photos: row.photos || [],
        pricing: Object.keys(pricing).length > 0 ? pricing : undefined,
      }
    })

    // Remove duplicates by city name and format for autocomplete
    const uniqueCities = Array.from(
      new Set(results.map((w) => w.city))
    ).sort()

    const responseData = {
      success: true,
      data: {
        warehouses: results,
        cities: uniqueCities,
      },
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, {
      context: "Failed to search public warehouses",
    })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

