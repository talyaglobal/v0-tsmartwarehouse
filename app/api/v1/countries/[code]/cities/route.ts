import { NextRequest, NextResponse } from "next/server"
import { fetchCitiesByCountry } from "@/lib/api/countries-cities"

/**
 * GET /api/v1/countries/[code]/cities
 * Get cities for a country using GeoNames API
 * 
 * Note: For better performance, register at https://www.geonames.org/login
 * and set GEONAMES_USERNAME in .env.local
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    
    // Validate country code format (ISO 3166-1 alpha-2: 2 uppercase letters)
    if (!code || !/^[A-Z]{2}$/.test(code.toUpperCase())) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid country code. Must be a 2-letter ISO code (e.g., US, TR, GB)',
        },
        { status: 400 }
      )
    }
    
    // Check if GEONAMES_USERNAME is set (optional but recommended)
    const username = process.env.GEONAMES_USERNAME
    if (!username || username === 'demo') {
      // Log warning but don't fail the request
      console.warn(
        'GeoNames API: GEONAMES_USERNAME not set. Using demo mode (limited). ' +
        'Register at https://www.geonames.org/login and set GEONAMES_USERNAME in .env.local'
      )
    }
    
    const cities = await fetchCitiesByCountry(code.toUpperCase())
    
    return NextResponse.json({
      success: true,
      data: cities,
    })
  } catch (error: any) {
    const { code } = await params
    console.error(`Error fetching cities for country ${code}:`, error)
    
    // Provide more specific error messages
    const errorMessage = error.message || 'Failed to fetch cities'
    
    // Check if account is not enabled
    const isAccountNotEnabled = errorMessage.includes('not enabled') || errorMessage.includes('enable it on your account')
    
    // Check if it's a rate limit error
    const isRateLimitError = errorMessage.includes('rate limit') || errorMessage.includes('limit exceeded')
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        // Include helpful message for common issues
        ...(isAccountNotEnabled && {
          message: 'GeoNames account not enabled for webservice. Please enable it at https://www.geonames.org/manageaccount',
        }),
        ...(isRateLimitError && {
          message: 'GeoNames API rate limit exceeded. Please register at https://www.geonames.org/login and set GEONAMES_USERNAME in .env.local',
        }),
        ...(errorMessage.includes('timeout') && {
          message: 'The request took too long. Please try again later.',
        }),
      },
      { status: isAccountNotEnabled || isRateLimitError ? 403 : 500 }
    )
  }
}

