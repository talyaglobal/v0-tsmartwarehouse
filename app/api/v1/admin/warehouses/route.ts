import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user || !['root', 'warehouse_admin', 'warehouse_supervisor'].includes(user.role || '')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = await createClient()

    // Build query
    let query = supabase
      .from('warehouses')
      .select(`
        id,
        name,
        address,
        city,
        zip_code,
        total_sq_ft,
        total_pallet_storage,
        available_sq_ft,
        available_pallet_storage,
        goods_type,
        storage_type,
        temperature_types,
        photos,
        status,
        owner_company_id,
        latitude,
        longitude,
        created_at,
        updated_at,
        companies:owner_company_id(short_name)
      `)
      .order('created_at', { ascending: false })

    // Apply status filter
    if (status === 'active') {
      query = query.eq('status', true)
    } else if (status === 'inactive') {
      query = query.eq('status', false)
    }

    // Apply type filter
    if (type && type !== 'all') {
      query = query.contains('goods_type', [type])
    }

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,address.ilike.%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: warehouses, error } = await query

    if (error) {
      console.error('Error fetching warehouses:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch warehouses', details: error.message },
        { status: 500 }
      )
    }

    // Get booking counts for each warehouse
    const warehouseIds = warehouses?.map(w => w.id) || []
    const bookingCounts: Record<string, number> = {}

    if (warehouseIds.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('warehouse_id')
        .in('warehouse_id', warehouseIds)
        .eq('status', true)
        .in('booking_status', ['active', 'confirmed', 'pending'])

      bookings?.forEach((b: any) => {
        if (b.warehouse_id) {
          bookingCounts[b.warehouse_id] = (bookingCounts[b.warehouse_id] || 0) + 1
        }
      })
    }

    // Calculate stats
    let totalSqFt = 0
    let totalPallets = 0
    let usedSqFt = 0
    let usedPallets = 0
    let activeCount = 0
    let inactiveCount = 0

    warehouses?.forEach((w: any) => {
      totalSqFt += w.total_sq_ft || 0
      totalPallets += w.total_pallet_storage || 0
      usedSqFt += (w.total_sq_ft || 0) - (w.available_sq_ft || w.total_sq_ft || 0)
      usedPallets += (w.total_pallet_storage || 0) - (w.available_pallet_storage || w.total_pallet_storage || 0)
      
      if (w.status) {
        activeCount++
      } else {
        inactiveCount++
      }
    })

    // Transform data
    const transformedWarehouses = (warehouses || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      address: w.address,
      city: w.city,
      zip_code: w.zip_code,
      total_sq_ft: w.total_sq_ft,
      total_pallet_storage: w.total_pallet_storage,
      available_sq_ft: w.available_sq_ft,
      available_pallet_storage: w.available_pallet_storage,
      goods_type: w.goods_type || [],
      storage_type: w.storage_type || [],
      temperature_types: w.temperature_types || [],
      photos: w.photos || [],
      status: w.status,
      company_id: w.owner_company_id,
      company_name: w.companies?.short_name || null,
      latitude: w.latitude,
      longitude: w.longitude,
      created_at: w.created_at,
      updated_at: w.updated_at,
      booking_count: bookingCounts[w.id] || 0,
    }))

    return NextResponse.json({
      success: true,
      data: transformedWarehouses,
      stats: {
        total: warehouses?.length || 0,
        active: activeCount,
        inactive: inactiveCount,
        totalSqFt,
        totalPallets,
        usedSqFt,
        usedPallets,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in admin warehouses API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
