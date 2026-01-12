import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user || !['root', 'warehouse_admin', 'warehouse_supervisor'].includes(user.role || '')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const supabase = await createClient()

    // Fetch warehouses with capacity info
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select(`
        id,
        name,
        city,
        total_sq_ft,
        available_sq_ft,
        total_pallet_storage,
        available_pallet_storage,
        status
      `)
      .order('name')

    // Fetch all bookings
    const { data: allBookings } = await supabase
      .from('bookings')
      .select('id, warehouse_id, status, created_at, updated_at')

    // Calculate overall capacity metrics
    let totalCapacity = 0
    let availableCapacity = 0

    const warehousePerformance = (warehouses || []).map(warehouse => {
      const wTotalSqFt = warehouse.total_sq_ft || 0
      const wAvailableSqFt = warehouse.available_sq_ft || 0

      totalCapacity += wTotalSqFt
      availableCapacity += wAvailableSqFt

      const usedCapacity = wTotalSqFt - wAvailableSqFt
      const utilization = wTotalSqFt > 0 ? (usedCapacity / wTotalSqFt) * 100 : 0

      // Count bookings for this warehouse
      const warehouseBookings = (allBookings || []).filter(b => b.warehouse_id === warehouse.id)
      const bookingCount = warehouseBookings.length

      return {
        id: warehouse.id,
        name: warehouse.name,
        city: warehouse.city || 'Unknown',
        utilization,
        bookingCount,
        status: warehouse.status !== false,
      }
    })

    // Sort by utilization descending
    warehousePerformance.sort((a, b) => b.utilization - a.utilization)

    const usedCapacity = totalCapacity - availableCapacity
    const currentUtilization = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0
    const targetUtilization = 80 // Default target

    // Calculate booking metrics
    const bookings = allBookings || []
    const totalBookings = bookings.length
    const confirmedBookings = bookings.filter(b => 
      b.status === 'confirmed' || b.status === 'completed'
    ).length
    const pendingBookings = bookings.filter(b => 
      b.status === 'pending' || b.status === 'pending_payment'
    ).length

    // Calculate confirmation rate
    const confirmationRate = totalBookings > 0 
      ? (confirmedBookings / totalBookings) * 100 
      : 0

    // Calculate average processing time (in hours)
    // From created_at to when status changed to confirmed
    let totalProcessingTime = 0
    let processedCount = 0

    for (const booking of bookings) {
      if (booking.status === 'confirmed' || booking.status === 'completed') {
        const createdAt = new Date(booking.created_at)
        const updatedAt = new Date(booking.updated_at)
        const processingTimeHours = (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
        
        if (processingTimeHours > 0 && processingTimeHours < 720) { // Max 30 days
          totalProcessingTime += processingTimeHours
          processedCount++
        }
      }
    }

    const averageProcessingTime = processedCount > 0 
      ? totalProcessingTime / processedCount 
      : 24 // Default to 24 hours if no data

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          targetUtilization,
          currentUtilization,
          totalCapacity,
          usedCapacity,
          availableCapacity,
        },
        bookingMetrics: {
          totalBookings,
          confirmedBookings,
          pendingBookings,
          averageProcessingTime,
          confirmationRate,
        },
        warehousePerformance,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching performance data:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
