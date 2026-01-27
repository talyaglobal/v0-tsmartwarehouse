import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Create Supabase client (server-side with service role key)
    const supabase = createClient()

    // Parse location to get city name and zip code
    const searchTerm = location.trim().toLowerCase()
    const cityName = searchTerm.split(',')[0].trim()
    const zipMatch = searchTerm.match(/\b\d{5}(?:-\d{4})?\b/)

    console.log('[min-space] Searching for location:', location, 'cityName:', cityName, 'zipMatch:', zipMatch)

    // Query all warehouses first (without status filter to debug)
    const { data: allWarehouses, error: fetchError } = await supabase
      .from('warehouses')
      .select('id, name, min_sq_ft, city, zip_code, address, status')
    
    console.log('[min-space] All warehouses (no filter):', allWarehouses?.length, 'error:', fetchError)
    if (allWarehouses && allWarehouses.length > 0) {
      console.log('[min-space] Sample warehouse:', allWarehouses[0])
      console.log('[min-space] Status values:', [...new Set(allWarehouses.map(w => w.status))])
    }
    
    if (fetchError) {
      console.error('[min-space] Fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
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

    console.log('[min-space] No warehouse with min_sq_ft found')
    // If no min_sq_ft found, return null (no minimum defined)
    return NextResponse.json({
      minSpace: null,
      source: 'none',
      warehouseCount: 0,
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
