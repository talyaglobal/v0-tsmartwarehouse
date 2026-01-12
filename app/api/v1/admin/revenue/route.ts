import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user || !['root', 'warehouse_admin', 'warehouse_supervisor'].includes(user.role || '')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = parseInt(searchParams.get('period') || '30')
    
    const supabase = await createClient()
    const now = new Date()
    const periodStart = new Date(now.getTime() - period * 24 * 60 * 60 * 1000)
    const previousPeriodStart = new Date(periodStart.getTime() - period * 24 * 60 * 60 * 1000)

    // Fetch bookings for current period
    const { data: currentBookings } = await supabase
      .from('bookings')
      .select('id, total_price, warehouse_id, created_at, status')
      .gte('created_at', periodStart.toISOString())
      .in('status', ['confirmed', 'completed'])

    // Fetch bookings for previous period (for comparison)
    const { data: previousBookings } = await supabase
      .from('bookings')
      .select('id, total_price')
      .gte('created_at', previousPeriodStart.toISOString())
      .lt('created_at', periodStart.toISOString())
      .in('status', ['confirmed', 'completed'])

    // Calculate total revenue
    const totalRevenue = (currentBookings || []).reduce((sum, b) => sum + (b.total_price || 0), 0)
    const previousRevenue = (previousBookings || []).reduce((sum, b) => sum + (b.total_price || 0), 0)

    // Calculate revenue growth
    const revenueGrowth = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : 0

    // Get last 7 days for weekly revenue
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weeklyRevenue = (currentBookings || [])
      .filter(b => new Date(b.created_at) >= weekStart)
      .reduce((sum, b) => sum + (b.total_price || 0), 0)

    // Get last 30 days for monthly revenue
    const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const monthlyRevenue = (currentBookings || [])
      .filter(b => new Date(b.created_at) >= monthStart)
      .reduce((sum, b) => sum + (b.total_price || 0), 0)

    // Calculate average booking value
    const averageBookingValue = (currentBookings || []).length > 0 
      ? totalRevenue / (currentBookings || []).length 
      : 0

    // Get warehouses for top performers
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select('id, name')

    const warehouseMap = new Map((warehouses || []).map(w => [w.id, w.name]))

    // Calculate revenue by warehouse
    const revenueByWarehouse: Record<string, { revenue: number; bookingCount: number }> = {}
    for (const booking of currentBookings || []) {
      if (!revenueByWarehouse[booking.warehouse_id]) {
        revenueByWarehouse[booking.warehouse_id] = { revenue: 0, bookingCount: 0 }
      }
      revenueByWarehouse[booking.warehouse_id].revenue += booking.total_price || 0
      revenueByWarehouse[booking.warehouse_id].bookingCount += 1
    }

    // Top warehouses by revenue
    const topWarehouses = Object.entries(revenueByWarehouse)
      .map(([id, data]) => ({
        id,
        name: warehouseMap.get(id) || 'Unknown Warehouse',
        revenue: data.revenue,
        bookingCount: data.bookingCount,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Calculate revenue by month (last 6 months)
    const revenueByMonth: Array<{ month: string; revenue: number; bookings: number }> = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      
      const monthBookings = (currentBookings || []).filter(b => {
        const bookingDate = new Date(b.created_at)
        return bookingDate >= monthDate && bookingDate <= monthEnd
      })

      revenueByMonth.push({
        month: monthName,
        revenue: monthBookings.reduce((sum, b) => sum + (b.total_price || 0), 0),
        bookings: monthBookings.length,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue,
        monthlyRevenue,
        weeklyRevenue,
        averageBookingValue,
        revenueGrowth,
        topWarehouses,
        revenueByMonth,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching revenue data:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
