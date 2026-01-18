import { type NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
// Using Supabase implementation with PostGIS support
import { searchWarehouses } from "@/lib/services/warehouse-search-supabase"
import { z } from "zod"
import type { WarehouseSearchParams } from "@/types/marketplace"

/**
 * Validation schema for search parameters
 */
const searchParamsSchema = z.object({
  // Location-based search
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius_km: z.coerce.number().min(1).max(500).optional().default(50),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),

  // Booking requirements
  type: z.enum(['pallet', 'area-rental']).optional(),
  quantity: z.coerce.number().min(1).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Filters
  goods_type: z.string().transform((s) => s ? s.split(',') : undefined).optional(),
  storage_type: z.string().transform((s) => s ? s.split(',') : undefined).optional(),
  temperature_types: z.string().transform((s) => s ? s.split(',') : undefined).optional(),
  amenities: z.string().transform((s) => s ? s.split(',') : undefined).optional(),
  security: z.string().transform((s) => s ? s.split(',') : undefined).optional(),

  // Pricing
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),

  // Rating
  min_rating: z.coerce.number().min(1).max(5).optional(),

  // Pagination & sorting
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  sort_by: z.enum(['price', 'distance', 'rating', 'availability', 'name']).optional().default('distance'),
  sort_order: z.enum(['asc', 'desc']).optional().default('asc'),

  // Legacy support
  q: z.string().optional(),
  offset: z.coerce.number().min(0).optional(), // Legacy pagination
})

/**
 * GET /api/v1/warehouses/public/search
 * Enhanced public endpoint to search warehouses with filters, sorting, and pagination
 * Currently using Supabase implementation. Prisma version available for future migration.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse and validate search parameters
    const rawParams = Object.fromEntries(searchParams.entries())
    const validationResult = searchParamsSchema.safeParse(rawParams)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid search parameters",
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          statusCode: 400,
        } as ErrorResponse,
        { status: 400 }
      )
    }

    const params = validationResult.data

    // Map legacy 'q' parameter to city if city not provided
    if (params.q && !params.city) {
      params.city = params.q
    }

    // Build search query parameters
    const queryParams: WarehouseSearchParams = {
      lat: params.lat,
      lng: params.lng,
      radius_km: params.radius_km,
      city: params.city,
      state: params.state,
      zipCode: params.zipCode,
      type: params.type,
      quantity: params.quantity,
      start_date: params.start_date,
      end_date: params.end_date,
      goods_type: params.goods_type,
      storage_type: params.storage_type,
      temperature_types: params.temperature_types,
      amenities: params.amenities,
      security: params.security,
      min_price: params.min_price,
      max_price: params.max_price,
      min_rating: params.min_rating,
      page: params.page,
      limit: params.limit,
      sort_by: params.sort_by,
      sort_order: params.sort_order,
    }

    // Use Supabase-based search service with PostGIS support
    const results = await searchWarehouses(queryParams)

    // Get unique cities for autocomplete (legacy support)
    const uniqueCities = Array.from(
      new Set(results.warehouses.map((w) => w.city))
    ).sort()

    const responseData = {
      success: true,
      data: {
        warehouses: results.warehouses,
        total: results.total,
        page: results.page,
        limit: results.limit,
        total_pages: results.total_pages,
        hasMore: results.page < results.total_pages,
        cities: uniqueCities, // Legacy support
      },
    }

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error("[warehouses/public/search] Error:", error)
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

