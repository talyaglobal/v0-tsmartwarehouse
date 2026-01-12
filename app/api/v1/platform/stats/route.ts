import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // Cache for 5 minutes

/**
 * GET /api/v1/platform/stats
 * Returns platform-wide statistics (warehouse count, city count)
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    // Get total warehouse count
    const { count: warehouseCount, error: warehouseError } = await supabase
      .from('warehouses')
      .select('id', { count: 'exact', head: true })

    if (warehouseError) {
      console.error('Error fetching warehouse count:', warehouseError)
    }

    // Get unique city count from all warehouses
    const { data: cities, error: cityError } = await supabase
      .from('warehouses')
      .select('city')

    if (cityError) {
      console.error('Error fetching cities:', cityError)
    }

    // Count unique cities (case-insensitive)
    const uniqueCities = new Set(
      (cities || [])
        .map(w => w.city?.toLowerCase().trim())
        .filter(Boolean)
    )

    return NextResponse.json({
      success: true,
      data: {
        warehouseCount: warehouseCount || 0,
        cityCount: uniqueCities.size || 0,
      }
    })
  } catch (error) {
    console.error('Platform stats error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch platform stats',
        data: {
          warehouseCount: 0,
          cityCount: 0,
        }
      },
      { status: 500 }
    )
  }
}
