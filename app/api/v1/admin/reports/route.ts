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
      .select('id, total_price, status, created_at')
      .gte('created_at', periodStart.toISOString())

    // Fetch bookings for previous period
    const { data: previousBookings } = await supabase
      .from('bookings')
      .select('id, total_price, status')
      .gte('created_at', previousPeriodStart.toISOString())
      .lt('created_at', periodStart.toISOString())

    // Fetch users created in current period
    const { data: currentUsers } = await supabase
      .from('profiles')
      .select('id, created_at')
      .gte('created_at', periodStart.toISOString())

    // Fetch users created in previous period
    const { data: previousUsers } = await supabase
      .from('profiles')
      .select('id')
      .gte('created_at', previousPeriodStart.toISOString())
      .lt('created_at', periodStart.toISOString())

    // Fetch all users count
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    // Fetch active warehouses
    const { count: activeWarehouses } = await supabase
      .from('warehouses')
      .select('id', { count: 'exact', head: true })
      .eq('status', true)

    // Fetch companies count
    const { count: totalCompanies } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })

    // Calculate booking stats
    const bookings = currentBookings || []
    const totalBookings = bookings.length
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length
    const pendingBookings = bookings.filter(b => b.status === 'pending' || b.status === 'pending_payment').length
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length

    // Calculate revenue
    const totalRevenue = bookings
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_price || 0), 0)

    const previousRevenue = (previousBookings || [])
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_price || 0), 0)

    // Calculate period comparisons
    const previousBookingsCount = (previousBookings || []).length
    const bookingsChange = previousBookingsCount > 0 
      ? ((totalBookings - previousBookingsCount) / previousBookingsCount) * 100 
      : 0

    const revenueChange = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : 0

    const previousUsersCount = (previousUsers || []).length
    const currentUsersCount = (currentUsers || []).length
    const usersChange = previousUsersCount > 0 
      ? ((currentUsersCount - previousUsersCount) / previousUsersCount) * 100 
      : 0

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalBookings,
          confirmedBookings,
          pendingBookings,
          cancelledBookings,
          totalRevenue,
          totalUsers: totalUsers || 0,
          activeWarehouses: activeWarehouses || 0,
          totalCompanies: totalCompanies || 0,
        },
        periodComparison: {
          bookingsChange,
          revenueChange,
          usersChange,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching report data:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
