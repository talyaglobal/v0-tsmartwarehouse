import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse location to get city name
    const searchTerm = location.trim().toLowerCase()
    const cityName = searchTerm.split(',')[0].trim()
    const zipMatch = searchTerm.match(/\b\d{5}(?:-\d{4})?\b/)

    // Query warehouses in this city with min_sq_ft > 0, ordered by min_sq_ft ascending
    let query = supabase
      .from('warehouses')
      .select('min_sq_ft, city, zip_code')
      .eq('status', true)
      .gt('min_sq_ft', 0)
      .order('min_sq_ft', { ascending: true })
      .limit(1)

    // Filter by location
    if (zipMatch) {
      query = query.eq('zip_code', zipMatch[0])
    } else if (cityName) {
      query = query.ilike('city', `%${cityName}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[min-space] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If found, return the minimum min_sq_ft
    if (data && data.length > 0 && data[0].min_sq_ft) {
      return NextResponse.json({
        minSpace: data[0].min_sq_ft,
        source: 'min_sq_ft',
        warehouseCount: 1
      })
    }

    // If no min_sq_ft found, return default
    return NextResponse.json({
      minSpace: 1000,
      source: 'default',
      warehouseCount: 0
    })

  } catch (error: any) {
    console.error('[min-space] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch minimum space' },
      { status: 500 }
    )
  }
}
