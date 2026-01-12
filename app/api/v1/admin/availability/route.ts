import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'

export const dynamic = 'force-dynamic'

export interface WarehouseAvailability {
  id: string
  name: string
  city: string
  address: string
  // Pallet capacity
  totalPalletCapacity: number
  usedPalletCapacity: number
  availablePalletCapacity: number
  palletUtilizationPercent: number
  // Area capacity
  totalSqFt: number
  usedSqFt: number
  availableSqFt: number
  areaUtilizationPercent: number
  // Bookings
  activeBookingsCount: number
  pendingBookingsCount: number
  // Owner
  ownerCompanyName?: string
  ownerCompanyId?: string
}

/**
 * GET /api/v1/admin/availability
 * Get all warehouses with their capacity and availability
 * Only accessible by root/admin users
 */
export async function GET() {
  try {
    // Use the same auth pattern as other admin routes
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    // Allow root users or admin users
    if (user.role !== 'root' && user.role !== 'warehouse_admin' && user.role !== 'warehouse_supervisor') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required', userRole: user.role },
        { status: 403 }
      )
    }

    const supabase = await createClient()

    // Get all warehouses
    const { data: warehouses, error: warehousesError } = await supabase
      .from('warehouses')
      .select(`
        id,
        name,
        city,
        address,
        total_sq_ft,
        total_pallet_storage,
        available_sq_ft,
        available_pallet_storage,
        owner_company_id,
        status
      `)
      .order('name', { ascending: true })

    if (warehousesError) {
      console.error('Failed to fetch warehouses:', warehousesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch warehouses', debug: warehousesError.message },
        { status: 500 }
      )
    }

    if (!warehouses || warehouses.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        totals: {
          totalWarehouses: 0,
          totalPalletCapacity: 0,
          usedPalletCapacity: 0,
          availablePalletCapacity: 0,
          totalSqFt: 0,
          usedSqFt: 0,
          availableSqFt: 0,
          totalActiveBookings: 0,
          totalPendingBookings: 0,
        },
        message: 'No warehouses found in database',
        timestamp: new Date().toISOString(),
      })
    }

    // Get company names for owners
    const companyIds = [...new Set(warehouses.map(w => w.owner_company_id).filter(Boolean))]
    let companyMap = new Map<string, string>()
    
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds)
      
      companyMap = new Map(companies?.map(c => [c.id, c.name]) || [])
    }

    // Get active bookings for each warehouse to calculate used capacity
    const warehouseIds = warehouses.map(w => w.id)
    
    let bookings: Array<{
      id: string
      warehouse_id: string
      type: string
      pallet_count: number | null
      area_sq_ft: number | null
      booking_status: string
    }> = []

    if (warehouseIds.length > 0) {
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          warehouse_id,
          type,
          pallet_count,
          area_sq_ft,
          booking_status
        `)
        .in('warehouse_id', warehouseIds)
        .eq('status', true) // Only non-deleted bookings

      if (bookingsError) {
        console.error('Failed to fetch bookings:', bookingsError)
        // Continue without bookings data
      } else {
        bookings = bookingsData || []
      }
    }

    // Calculate availability for each warehouse
    const availabilityData: WarehouseAvailability[] = warehouses.map(warehouse => {
      // Get bookings for this warehouse
      const warehouseBookings = bookings.filter(b => b.warehouse_id === warehouse.id)
      
      // Calculate used capacity from active/confirmed bookings only
      const activeBookings = warehouseBookings.filter(b => 
        b.booking_status === 'active' || b.booking_status === 'confirmed'
      )
      
      const pendingBookings = warehouseBookings.filter(b => 
        b.booking_status === 'pending' || b.booking_status === 'payment_pending' || b.booking_status === 'awaiting_time_slot'
      )

      // Sum up used pallets
      const usedPallets = activeBookings
        .filter(b => b.type === 'pallet')
        .reduce((sum, b) => sum + (b.pallet_count || 0), 0)

      // Sum up used area
      const usedArea = activeBookings
        .filter(b => b.type === 'area' || b.type === 'area-rental')
        .reduce((sum, b) => sum + (b.area_sq_ft || 0), 0)

      const totalPallets = warehouse.total_pallet_storage || 0
      const totalSqFt = warehouse.total_sq_ft || 0

      return {
        id: warehouse.id,
        name: warehouse.name || 'Unnamed Warehouse',
        city: warehouse.city || '',
        address: warehouse.address || '',
        // Pallet capacity
        totalPalletCapacity: totalPallets,
        usedPalletCapacity: usedPallets,
        availablePalletCapacity: Math.max(0, totalPallets - usedPallets),
        palletUtilizationPercent: totalPallets > 0 
          ? Math.round((usedPallets / totalPallets) * 100) 
          : 0,
        // Area capacity
        totalSqFt: totalSqFt,
        usedSqFt: usedArea,
        availableSqFt: Math.max(0, totalSqFt - usedArea),
        areaUtilizationPercent: totalSqFt > 0 
          ? Math.round((usedArea / totalSqFt) * 100) 
          : 0,
        // Bookings
        activeBookingsCount: activeBookings.length,
        pendingBookingsCount: pendingBookings.length,
        // Owner
        ownerCompanyName: warehouse.owner_company_id ? companyMap.get(warehouse.owner_company_id) : undefined,
        ownerCompanyId: warehouse.owner_company_id || undefined,
      }
    })

    // Calculate totals
    const totals = {
      totalWarehouses: availabilityData.length,
      totalPalletCapacity: availabilityData.reduce((sum, w) => sum + w.totalPalletCapacity, 0),
      usedPalletCapacity: availabilityData.reduce((sum, w) => sum + w.usedPalletCapacity, 0),
      availablePalletCapacity: availabilityData.reduce((sum, w) => sum + w.availablePalletCapacity, 0),
      totalSqFt: availabilityData.reduce((sum, w) => sum + w.totalSqFt, 0),
      usedSqFt: availabilityData.reduce((sum, w) => sum + w.usedSqFt, 0),
      availableSqFt: availabilityData.reduce((sum, w) => sum + w.availableSqFt, 0),
      totalActiveBookings: availabilityData.reduce((sum, w) => sum + w.activeBookingsCount, 0),
      totalPendingBookings: availabilityData.reduce((sum, w) => sum + w.pendingBookingsCount, 0),
    }

    return NextResponse.json({
      success: true,
      data: availabilityData,
      totals,
      bookingsCount: bookings.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Availability API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}
