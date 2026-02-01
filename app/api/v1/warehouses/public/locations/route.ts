import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/warehouses/public/locations
 * Public endpoint for location autocomplete
 * Returns matching cities/locations based on search query
 * 
 * Query Parameters:
 * - q: Search query (e.g., "new" returns "New York", "Newark", etc.)
 * - limit: Max results (default: 10)
 * 
 * Example: /api/v1/warehouses/public/locations?q=new&limit=5
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.toLowerCase().trim() || ""
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20)

    const supabase = createServerSupabaseClient()

    // Get all active warehouses with location data
    // Note: 'state' column doesn't exist in the current schema, using only city and zip_code
    const { data, error } = await supabase
      .from("warehouses")
      .select("id, name, city, zip_code, address")
      .eq("status", true)
      .order("city", { ascending: true })

    if (error) {
      console.error("[locations] Query error:", error)
      throw new Error(`Failed to fetch locations: ${error.message}`)
    }

    // Build location suggestions
    const locations: Array<{
      id: string
      label: string
      city: string
      zipCode: string | null
      type: "city" | "zip"
      warehouseCount?: number
    }> = []

    // Track unique cities and their warehouse counts
    const cityMap = new Map<string, { count: number; zipCodes: Set<string> }>()

    for (const warehouse of data || []) {
      const city = (warehouse.city || "").trim()
      const zipCode = (warehouse.zip_code || "").trim()

      if (city) {
        const key = city.toLowerCase()
        if (!cityMap.has(key)) {
          cityMap.set(key, { count: 0, zipCodes: new Set() })
        }
        const entry = cityMap.get(key)!
        entry.count++
        if (zipCode) {
          entry.zipCodes.add(zipCode)
        }
      }
    }

    // Filter and build city suggestions
    for (const [cityLower, value] of cityMap) {
      // Find original case city name
      const city = (data || []).find(w => w.city?.toLowerCase() === cityLower)?.city || cityLower

      // Check if city matches query (if no query, return all)
      const cityMatches = !query || 
        city.toLowerCase().includes(query) || 
        cityLower.includes(query)

      if (cityMatches) {
        locations.push({
          id: `city-${cityLower}`,
          label: city,
          city,
          zipCode: null,
          type: "city",
          warehouseCount: value.count,
        })
      }

      // Also add zip code matches
      for (const zip of value.zipCodes) {
        // Match if query is numeric and zip starts with it, or no query
        const zipMatches = !query || 
          (query.match(/^\d+$/) && zip.startsWith(query)) ||
          zip.includes(query)
        
        if (zipMatches && query) {  // Only add zip suggestions when there's a query
          locations.push({
            id: `zip-${zip}`,
            label: `${zip} - ${city}`,
            city,
            zipCode: zip,
            type: "zip",
          })
        }
      }
    }

    // Sort by relevance (exact match first, then starts with, then contains)
    const sortedLocations = locations
      .sort((a, b) => {
        const aLower = a.label.toLowerCase()
        const bLower = b.label.toLowerCase()

        // Exact match first
        if (aLower === query && bLower !== query) return -1
        if (bLower === query && aLower !== query) return 1

        // Starts with query
        if (aLower.startsWith(query) && !bLower.startsWith(query)) return -1
        if (bLower.startsWith(query) && !aLower.startsWith(query)) return 1

        // More warehouses first
        if ((a.warehouseCount || 0) !== (b.warehouseCount || 0)) {
          return (b.warehouseCount || 0) - (a.warehouseCount || 0)
        }

        // Alphabetical
        return aLower.localeCompare(bLower)
      })
      .slice(0, limit)

    const responseData = {
      success: true,
      data: {
        locations: sortedLocations,
        query,
        total: sortedLocations.length,
        // Debug info - remove in production
        _debug: {
          totalWarehouses: data?.length || 0,
          uniqueCities: cityMap.size,
        },
      },
    }

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (error) {
    console.error("[locations] Error:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to fetch locations",
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
