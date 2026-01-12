import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // Cache for 5 minutes

/**
 * GET /api/v1/public/stats
 * Public endpoint for marketing statistics
 * Returns platform-wide statistics without authentication
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

    // Get unique city count from warehouses
    const { data: cities, error: cityError } = await supabase
      .from('warehouses')
      .select('city')

    if (cityError) {
      console.error('Error fetching cities:', cityError)
    }

    const uniqueCities = new Set(
      cities?.map(w => w.city?.split(',')[0]?.trim()?.toLowerCase()).filter(Boolean)
    )
    const cityCount = uniqueCities.size

    // Get warehouse_client count
    const { count: clientCount, error: clientError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'warehouse_client')

    if (clientError) {
      console.error('Error fetching client count:', clientError)
    }

    // Get warehouse_broker count
    const { count: brokerCount, error: brokerError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'warehouse_broker')

    if (brokerError) {
      console.error('Error fetching broker count:', brokerError)
    }

    // Get transport_companies count
    const { count: transportCount, error: transportError } = await supabase
      .from('transport_companies')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    if (transportError) {
      console.error('Error fetching transport companies count:', transportError)
    }

    // Get warehouse_admin (owners) count
    const { count: ownerCount, error: ownerError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'warehouse_admin')

    if (ownerError) {
      console.error('Error fetching owner count:', ownerError)
    }

    // Get total users count (all roles)
    const { count: totalUsersCount, error: usersError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    if (usersError) {
      console.error('Error fetching total users count:', usersError)
    }

    // Get published warehouses count
    const { count: publishedWarehouseCount, error: publishedError } = await supabase
      .from('warehouses')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)

    if (publishedError) {
      console.error('Error fetching published warehouse count:', publishedError)
    }

    return NextResponse.json({
      success: true,
      data: {
        warehouses: {
          total: warehouseCount || 0,
          published: publishedWarehouseCount || 0,
        },
        cities: cityCount || 0,
        users: {
          total: totalUsersCount || 0,
          warehouse_clients: clientCount || 0,
          warehouse_brokers: brokerCount || 0,
          warehouse_owners: ownerCount || 0,
        },
        transport_companies: transportCount || 0,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[public/stats] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch platform stats',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
