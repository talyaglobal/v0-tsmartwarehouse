import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/kolaybase/server'

/**
 * GET /api/v1/warehouses/public/min-space
 * Returns the minimum min_sq_ft value among all warehouses in the given city
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const location = searchParams.get('location')

    if (!location) {
      return NextResponse.json({ minSpace: 1000, source: 'default', warehouseCount: 0 })
    }

    const supabase = createServerClient()

    // Parse location to get city name and zip code
    const searchTerm = location.trim().toLowerCase()
    const zipMatch = searchTerm.match(/\b\d{5}(?:-\d{4})?\b/)
    // Remove zip code and comma parts to get just the city name
    const cityName = searchTerm
      .split(',')[0]
      .replace(/\b\d{5}(?:-\d{4})?\b/, '')
      .trim()

    console.log('[min-space] Searching for location:', location, 'cityName:', cityName, 'zipMatch:', zipMatch)

    // Note: warehouses table has no 'status' column; all rows are considered active
    const result = await supabase
      .from('warehouses')
      .select('id, name, min_sq_ft, city, zip_code, address')

    const allWarehouses = result.data
    const fetchError = result.error


    if (fetchError) {
      console.error('[min-space] Fetch error:', JSON.stringify(fetchError))
      return NextResponse.json({ error: typeof fetchError === 'string' ? fetchError : fetchError?.message || 'Unknown error' }, { status: 500 })
    }

    // Filter warehouses by location (city name or zip code)
    const matchingWarehouses = (allWarehouses || []).filter(w => {
      const cityLower = (w.city || '').toLowerCase()
      const addressLower = (w.address || '').toLowerCase()
      const zipCode = w.zip_code || ''
      
      // Match by city name
      if (cityLower.includes(cityName)) return true
      // Match by address
      if (addressLower.includes(cityName)) return true
      // Match by zip code
      if (zipMatch && zipCode === zipMatch[0]) return true
      
      return false
    })
    
    console.log('[min-space] Matching warehouses:', matchingWarehouses.length, matchingWarehouses.map(w => ({ name: w.name, city: w.city, min_sq_ft: w.min_sq_ft })))
    
    const data = matchingWarehouses

    // If found, return the minimum min_sq_ft from matching warehouses
    if (data && data.length > 0) {
      // Filter warehouses with min_sq_ft > 0 and sort by min_sq_ft
      const warehousesWithMin = data
        .filter(w => w.min_sq_ft && w.min_sq_ft > 0)
        .sort((a, b) => a.min_sq_ft - b.min_sq_ft)
      
      console.log('[min-space] Warehouses with min_sq_ft:', warehousesWithMin.length)
      
      if (warehousesWithMin.length > 0) {
        const warehouseWithMin = warehousesWithMin[0]
        console.log('[min-space] Found warehouse with min_sq_ft:', warehouseWithMin.name, warehouseWithMin.min_sq_ft)
        return NextResponse.json({
          minSpace: warehouseWithMin.min_sq_ft,
          source: 'min_sq_ft',
          warehouseCount: data.length,
          hasMinimum: true
        })
      }
    }

    // No min_sq_ft found
    return NextResponse.json({
      minSpace: null,
      source: 'none',
      warehouseCount: matchingWarehouses.length,
      hasMinimum: false
    })

  } catch (error: any) {
    console.error('[min-space] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch minimum space' },
      { status: 500 }
    )
  }
}
