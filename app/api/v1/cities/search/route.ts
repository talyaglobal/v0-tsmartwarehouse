import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/v1/cities/search
 * Search cities worldwide using GeoNames API
 * Public endpoint (no authentication required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""

    // Trim query only for length check, but preserve spaces in the actual search
    const trimmedQuery = query.trim()
    if (!trimmedQuery || trimmedQuery.length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    const username = process.env.GEONAMES_USERNAME || "demo"

    // GeoNames API search for cities (featureClass P = populated places)
    // featureCode PPL = populated place (cities, towns, villages)
    // maxRows limited to 10 for autocomplete
    // Use trimmed query for search (internal spaces are preserved)
    const url = `https://secure.geonames.org/searchJSON?q=${encodeURIComponent(trimmedQuery)}&featureClass=P&featureCode=PPL&maxRows=10&orderby=population&username=${username}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === "AbortError" || controller.signal.aborted) {
        return NextResponse.json({
          success: true,
          data: [],
        })
      }
      throw fetchError
    }

    if (!response.ok) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    const data = await response.json()

    // Check for GeoNames API errors
    if (data.status && data.status.message) {
      console.error(`GeoNames API error: ${data.status.message}`)
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    if (!data.geonames || data.geonames.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      })
    }

    // Format results
    const cities = data.geonames.map((place: any) => {
      const cityName = place.name
      const state = place.adminName1 || place.adminCode1
      const country = place.countryName

      // Format: "City, State" or "City, Country" or "City"
      let displayName = cityName
      if (state) {
        displayName = `${cityName}, ${state}`
      } else if (country) {
        displayName = `${cityName}, ${country}`
      }

      return {
        name: displayName,
        city: cityName,
        state: state || undefined,
        country: country || undefined,
        countryCode: place.countryCode,
      }
    })

    return NextResponse.json({
      success: true,
      data: cities,
    })
  } catch (error: any) {
    console.error("Error searching cities:", error)
    // Return empty array on error to avoid breaking the UI
    return NextResponse.json({
      success: true,
      data: [],
    })
  }
}

