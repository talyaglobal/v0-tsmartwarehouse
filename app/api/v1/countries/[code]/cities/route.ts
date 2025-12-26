import { NextRequest, NextResponse } from "next/server"
import { fetchCitiesByCountry } from "@/lib/api/countries-cities"

/**
 * GET /api/v1/countries/[code]/cities
 * Get cities for a country
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const cities = await fetchCitiesByCountry(code)
    
    return NextResponse.json({
      success: true,
      data: cities,
    })
  } catch (error) {
    console.error(`Error fetching cities for country ${(await params).code}:`, error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cities',
      },
      { status: 500 }
    )
  }
}

