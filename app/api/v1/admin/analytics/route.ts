import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'

export const dynamic = 'force-dynamic'

interface AnalyticsData {
  overview: {
    totalWarehouses: number
    totalUsers: number
    totalBookings: number
    totalRevenue: number
    activeBookings: number
    pendingBookings: number
    confirmedBookings: number
    completedBookings: number
    totalCompanies: number
  }
  usersByRole: Record<string, number>
  bookingsByStatus: Record<string, number>
  todayStats: {
    uniqueVisitors: number
    newBookings: number
    newUsers: number
    revenue: number
  }
  topWarehouses: Array<{
    id: string
    name: string
    city: string
    bookingCount: number
    revenue: number
  }>
  recentActivity: {
    lastHourBookings: number
    last24HoursBookings: number
    lastWeekBookings: number
  }
  warehousesByCity: Record<string, number>
  warehouseLocations: Array<{
    id: string
    name: string
    city: string
    address?: string
    lat?: number
    lng?: number
    bookingCount: number
  }>
  monthlyTrends: Array<{
    month: string
    bookings: number
    revenue: number
  }>
  capacityOverview: {
    totalPalletCapacity: number
    usedPalletCapacity: number
    totalAreaSqFt: number
    usedAreaSqFt: number
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    // Only root, warehouse_admin, warehouse_supervisor can access admin analytics
    if (!user || !['root', 'warehouse_admin', 'warehouse_supervisor'].includes(user.role || '')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // ===== OVERVIEW COUNTS =====
    
    // Total warehouses
    const { count: totalWarehouses } = await supabase
      .from('warehouses')
      .select('id', { count: 'exact', head: true })

    // Total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    // Total bookings (non-deleted)
    const { count: totalBookings } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', true)

    // Active bookings (booking_status = 'active')
    const { count: activeBookings } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', true)
      .eq('booking_status', 'active')

    // Confirmed bookings (booking_status = 'confirmed')
    const { count: confirmedBookings } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', true)
      .eq('booking_status', 'confirmed')

    // Pending bookings (booking_status = 'pending' or 'payment_pending' or 'awaiting_time_slot')
    const { count: pendingBookings } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', true)
      .in('booking_status', ['pending', 'payment_pending', 'awaiting_time_slot'])

    // Completed bookings
    const { count: completedBookings } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', true)
      .eq('booking_status', 'completed')

    // Total companies
    const { count: totalCompanies } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })

    // Total revenue from completed/active bookings
    const { data: revenueData } = await supabase
      .from('bookings')
      .select('total_amount')
      .eq('status', true)
      .in('booking_status', ['completed', 'active', 'confirmed'])

    const totalRevenue = revenueData?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0

    // ===== USERS BY ROLE =====
    const { data: userRoles } = await supabase
      .from('profiles')
      .select('role')

    const usersByRole: Record<string, number> = {}
    userRoles?.forEach(u => {
      const role = u.role || 'unknown'
      usersByRole[role] = (usersByRole[role] || 0) + 1
    })

    // ===== BOOKINGS BY STATUS =====
    const { data: bookingStatuses } = await supabase
      .from('bookings')
      .select('booking_status')
      .eq('status', true)

    const bookingsByStatus: Record<string, number> = {}
    bookingStatuses?.forEach(b => {
      const status = b.booking_status || 'unknown'
      bookingsByStatus[status] = (bookingsByStatus[status] || 0) + 1
    })

    // ===== TODAY'S STATS =====
    
    // Today's new bookings
    const { count: todayNewBookings } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', true)
      .gte('created_at', todayStart.toISOString())

    // Today's new users
    const { count: todayNewUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())

    // Today's revenue
    const { data: todayRevenueData } = await supabase
      .from('bookings')
      .select('total_amount')
      .eq('status', true)
      .gte('created_at', todayStart.toISOString())
      .in('booking_status', ['completed', 'active', 'confirmed'])

    const todayRevenue = todayRevenueData?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0

    // Unique visitors today (from access_logs if available)
    let uniqueVisitors = 0
    try {
      const { count: visitorCount } = await supabase
        .from('access_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString())
      uniqueVisitors = visitorCount || todayNewUsers || 0
    } catch {
      uniqueVisitors = todayNewUsers || 0
    }

    // ===== RECENT ACTIVITY =====
    
    // Last hour bookings
    const { count: lastHourBookings } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', true)
      .gte('created_at', oneHourAgo.toISOString())

    // Last 24 hours bookings
    const { count: last24HoursBookings } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', true)
      .gte('created_at', oneDayAgo.toISOString())

    // Last week bookings
    const { count: lastWeekBookings } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', true)
      .gte('created_at', oneWeekAgo.toISOString())

    // ===== TOP WAREHOUSES =====
    const { data: warehouseBookings } = await supabase
      .from('bookings')
      .select('warehouse_id, total_amount')
      .eq('status', true)

    const warehouseStats: Record<string, { count: number; revenue: number }> = {}
    warehouseBookings?.forEach(b => {
      if (b.warehouse_id) {
        if (!warehouseStats[b.warehouse_id]) {
          warehouseStats[b.warehouse_id] = { count: 0, revenue: 0 }
        }
        warehouseStats[b.warehouse_id].count++
        warehouseStats[b.warehouse_id].revenue += b.total_amount || 0
      }
    })

    // Get top 5 warehouse IDs
    const topWarehouseIds = Object.entries(warehouseStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id]) => id)

    // Fetch warehouse details
    let topWarehouses: AnalyticsData['topWarehouses'] = []
    if (topWarehouseIds.length > 0) {
      const { data: warehouseDetails } = await supabase
        .from('warehouses')
        .select('id, name, city')
        .in('id', topWarehouseIds)

      topWarehouses = warehouseDetails?.map(w => ({
        id: w.id,
        name: w.name,
        city: w.city || 'Unknown',
        bookingCount: warehouseStats[w.id]?.count || 0,
        revenue: warehouseStats[w.id]?.revenue || 0,
      })).sort((a, b) => b.bookingCount - a.bookingCount) || []
    }

    // ===== WAREHOUSES BY CITY =====
    const { data: warehouseCities } = await supabase
      .from('warehouses')
      .select('city')

    const warehousesByCity: Record<string, number> = {}
    warehouseCities?.forEach(w => {
      const city = w.city || 'Unknown'
      warehousesByCity[city] = (warehousesByCity[city] || 0) + 1
    })

    // ===== WAREHOUSE LOCATIONS FOR MAP =====
    const { data: allWarehouses } = await supabase
      .from('warehouses')
      .select('id, name, city, address, latitude, longitude')

    const warehouseLocations: AnalyticsData['warehouseLocations'] = (allWarehouses || []).map(w => ({
      id: w.id,
      name: w.name,
      city: w.city || 'Unknown',
      address: w.address || undefined,
      lat: w.latitude || undefined,
      lng: w.longitude || undefined,
      bookingCount: warehouseStats[w.id]?.count || 0,
    }))

    // ===== CAPACITY OVERVIEW =====
    const { data: warehouseCapacities } = await supabase
      .from('warehouses')
      .select('total_sq_ft, total_pallet_storage')

    let totalPalletCapacity = 0
    let totalAreaSqFt = 0
    warehouseCapacities?.forEach(w => {
      totalPalletCapacity += w.total_pallet_storage || 0
      totalAreaSqFt += w.total_sq_ft || 0
    })

    // Calculate used capacity from active bookings
    const { data: activeBookingsData } = await supabase
      .from('bookings')
      .select('pallet_count, area_sq_ft')
      .eq('status', true)
      .in('booking_status', ['active', 'confirmed'])

    let usedPalletCapacity = 0
    let usedAreaSqFt = 0
    activeBookingsData?.forEach(b => {
      usedPalletCapacity += b.pallet_count || 0
      usedAreaSqFt += b.area_sq_ft || 0
    })

    // ===== MONTHLY TRENDS (Last 6 months) =====
    const monthlyTrends: AnalyticsData['monthlyTrends'] = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
      
      const { count: monthBookings } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', true)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())

      const { data: monthRevenueData } = await supabase
        .from('bookings')
        .select('total_amount')
        .eq('status', true)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .in('booking_status', ['completed', 'active', 'confirmed'])

      const monthRevenue = monthRevenueData?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0

      monthlyTrends.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        bookings: monthBookings || 0,
        revenue: monthRevenue,
      })
    }

    const analytics: AnalyticsData = {
      overview: {
        totalWarehouses: totalWarehouses || 0,
        totalUsers: totalUsers || 0,
        totalBookings: totalBookings || 0,
        totalRevenue,
        activeBookings: activeBookings || 0,
        pendingBookings: pendingBookings || 0,
        confirmedBookings: confirmedBookings || 0,
        completedBookings: completedBookings || 0,
        totalCompanies: totalCompanies || 0,
      },
      usersByRole,
      bookingsByStatus,
      todayStats: {
        uniqueVisitors,
        newBookings: todayNewBookings || 0,
        newUsers: todayNewUsers || 0,
        revenue: todayRevenue,
      },
      topWarehouses,
      recentActivity: {
        lastHourBookings: lastHourBookings || 0,
        last24HoursBookings: last24HoursBookings || 0,
        lastWeekBookings: lastWeekBookings || 0,
      },
      warehousesByCity,
      warehouseLocations,
      monthlyTrends,
      capacityOverview: {
        totalPalletCapacity,
        usedPalletCapacity,
        totalAreaSqFt,
        usedAreaSqFt,
      },
    }

    return NextResponse.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching admin analytics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
