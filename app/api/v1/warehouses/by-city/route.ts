import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getWarehouses } from "@/lib/db/warehouses"
import { calculateWarehouseAvailability, type WarehouseAvailability } from "@/lib/business-logic/capacity-management"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"

export interface WarehousePricing {
  id: string
  warehouseId: string
  pricingType: 'pallet' | 'area'
  basePrice: number // Base price per unit
  unit: string // 'per_pallet_per_month', 'per_sqft_per_month', etc.
  minQuantity?: number
  maxQuantity?: number
  volumeDiscounts?: Record<string, number> // {threshold: discount_percentage}
}

export interface WarehouseWithPricing {
  id: string
  name: string
  address: string
  city: string
  zipCode: string
  latitude?: number
  longitude?: number
  totalSqFt: number
  totalPalletStorage?: number
  pricing: {
    pallet?: WarehousePricing
    areaRental?: WarehousePricing
  }
  availability?: {
    pallet?: WarehouseAvailability
    areaRental?: WarehouseAvailability
  }
}

/**
 * GET /api/v1/warehouses/by-city
 * Get warehouses by city with pricing and availability information
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { searchParams } = new URL(request.url)

    // Get query parameters
    const city = searchParams.get('city')
    const fromDate = searchParams.get('fromDate') // Optional: for availability check
    const toDate = searchParams.get('toDate') // Optional: for availability check

    // Validate required parameters
    if (!city) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Missing required parameter: city is required',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Get warehouses by city
    const warehouses = await getWarehouses({ city })

    if (warehouses.length === 0) {
      const responseData = {
        success: true,
        data: [],
      }
      return NextResponse.json(responseData)
    }

    const supabase = createServerSupabaseClient()

    // Get pricing for all warehouses
    const warehouseIds = warehouses.map(w => w.id)
    const { data: pricingData, error: pricingError } = await supabase
      .from('warehouse_pricing')
      .select('id, warehouse_id, pricing_type, base_price, unit, min_quantity, max_quantity, volume_discounts')
      .in('warehouse_id', warehouseIds)
      .eq('status', true) // Soft delete filter

    if (pricingError) {
      throw new Error(`Failed to fetch pricing: ${pricingError.message}`)
    }

    // Group pricing by warehouse
    const pricingMap = new Map<string, { pallet?: WarehousePricing; area?: WarehousePricing }>()
    pricingData?.forEach((price: any) => {
      const warehouseId = price.warehouse_id
      if (!pricingMap.has(warehouseId)) {
        pricingMap.set(warehouseId, {})
      }
      const pricing = pricingMap.get(warehouseId)!

      if (price.pricing_type === 'pallet') {
        pricing.pallet = {
          id: price.id,
          warehouseId: price.warehouse_id,
          pricingType: 'pallet',
          basePrice: parseFloat(price.base_price),
          unit: price.unit || 'per_pallet_per_month',
          minQuantity: price.min_quantity || undefined,
          maxQuantity: price.max_quantity || undefined,
          volumeDiscounts: price.volume_discounts || undefined,
        }
      } else if (price.pricing_type === 'area') {
        pricing.area = {
          id: price.id,
          warehouseId: price.warehouse_id,
          pricingType: 'area',
          basePrice: parseFloat(price.base_price),
          unit: price.unit || 'per_sqft_per_month',
          minQuantity: price.min_quantity || undefined,
          maxQuantity: price.max_quantity || undefined,
          volumeDiscounts: price.volume_discounts || undefined,
        }
      }
    })

    // Build response with pricing and optional availability
    const warehousesWithPricing: WarehouseWithPricing[] = await Promise.all(
      warehouses.map(async (warehouse) => {
        const warehousePricing = pricingMap.get(warehouse.id) || {}

        const result: WarehouseWithPricing = {
          id: warehouse.id,
          name: warehouse.name,
          address: warehouse.address,
          city: warehouse.city,
          zipCode: warehouse.zipCode,
          latitude: warehouse.latitude,
          longitude: warehouse.longitude,
          totalSqFt: warehouse.totalSqFt,
          totalPalletStorage: warehouse.totalPalletStorage,
          pricing: {
            pallet: warehousePricing.pallet,
            areaRental: warehousePricing.area,
          },
        }

        // If date range is provided, calculate availability
        if (fromDate && toDate) {
          result.availability = {}

          // Calculate pallet availability
          if (warehousePricing.pallet) {
            try {
              const palletAvailability = await calculateWarehouseAvailability(
                warehouse.id,
                fromDate,
                toDate,
                'pallet'
              )
              result.availability.pallet = palletAvailability
            } catch (error) {
              // If availability calculation fails, just skip it
              console.error(`Failed to calculate pallet availability for warehouse ${warehouse.id}:`, error)
            }
          }

          // Calculate area rental availability
          if (warehousePricing.area) {
            try {
              const areaRentalAvailability = await calculateWarehouseAvailability(
                warehouse.id,
                fromDate,
                toDate,
                'area-rental'
              )
              result.availability.areaRental = areaRentalAvailability
            } catch (error) {
              // If availability calculation fails, just skip it
              console.error(`Failed to calculate area rental availability for warehouse ${warehouse.id}:`, error)
            }
          }
        }

        return result
      })
    )

    const responseData = {
      success: true,
      data: warehousesWithPricing,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: 'Failed to get warehouses by city' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

