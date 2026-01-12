import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    
    // Only root, warehouse_admin, warehouse_supervisor can access admin bookings
    if (!user || !['root', 'warehouse_admin', 'warehouse_supervisor'].includes(user.role || '')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    const supabase = await createClient()

    // Build query for ALL bookings (admin view)
    let query = supabase
      .from('bookings')
      .select(`
        id,
        customer_id,
        customer_name,
        customer_email,
        warehouse_id,
        type,
        booking_status,
        status,
        pallet_count,
        area_sq_ft,
        floor_number,
        hall_id,
        start_date,
        end_date,
        total_amount,
        notes,
        scheduled_dropoff_datetime,
        time_slot_set_by,
        time_slot_set_at,
        time_slot_confirmed_at,
        proposed_start_date,
        proposed_start_time,
        date_change_requested_at,
        date_change_requested_by,
        created_at,
        updated_at,
        warehouses!inner(id, name, city, address)
      `, { count: 'exact' })
      .eq('status', true) // Only non-deleted bookings

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('booking_status', status)
    }

    if (type && type !== 'all') {
      query = query.eq('type', type)
    }

    if (search) {
      query = query.or(`id.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`)
    }

    // Get total count before pagination
    const { count } = await query

    // Apply pagination and ordering
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching admin bookings:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch bookings', details: error.message },
        { status: 500 }
      )
    }

    // Transform data
    const bookings = (data || []).map((row: any) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouses?.name || 'Unknown',
      warehouseCity: row.warehouses?.city || '',
      type: row.type,
      status: row.booking_status,
      palletCount: row.pallet_count,
      areaSqFt: row.area_sq_ft,
      floorNumber: row.floor_number,
      hallId: row.hall_id,
      startDate: row.start_date,
      endDate: row.end_date,
      totalAmount: parseFloat(row.total_amount || 0),
      notes: row.notes,
      scheduledDropoffDatetime: row.scheduled_dropoff_datetime,
      timeSlotSetBy: row.time_slot_set_by,
      timeSlotSetAt: row.time_slot_set_at,
      timeSlotConfirmedAt: row.time_slot_confirmed_at,
      proposedStartDate: row.proposed_start_date,
      proposedStartTime: row.proposed_start_time,
      dateChangeRequestedAt: row.date_change_requested_at,
      dateChangeRequestedBy: row.date_change_requested_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return NextResponse.json({
      success: true,
      data: bookings,
      total: count || 0,
      limit,
      offset,
      hasMore: offset + limit < (count || 0),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in admin bookings API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
