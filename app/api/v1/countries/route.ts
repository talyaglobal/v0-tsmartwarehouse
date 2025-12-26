import { NextResponse } from "next/server"
import { fetchCountries } from "@/lib/api/countries-cities"

/**
 * GET /api/v1/countries
 * Get all countries from REST Countries API
 */
export async function GET() {
  try {
    const countries = await fetchCountries()
    
    return NextResponse.json({
      success: true,
      data: countries,
    })
  } catch (error) {
    console.error('Error fetching countries:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch countries',
      },
      { status: 500 }
    )
  }
}

