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

    // Fetch all warehouses with capacity info
    const { data: warehouses, error: warehousesError } = await supabase
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

    if (warehousesError) {
      console.error('Error fetching warehouses:', warehousesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch warehouses' },
        { status: 500 }
      )
    }

    // Calculate overall stats
    let totalSqFt = 0
    let availableSqFt = 0
    let totalPallets = 0
    let availablePallets = 0

    const warehouseStats = (warehouses || []).map(warehouse => {
      const wTotalSqFt = warehouse.total_sq_ft || 0
      const wAvailableSqFt = warehouse.available_sq_ft || 0
      const wTotalPallets = warehouse.total_pallet_storage || 0
      const wAvailablePallets = warehouse.available_pallet_storage || 0

      totalSqFt += wTotalSqFt
      availableSqFt += wAvailableSqFt
      totalPallets += wTotalPallets
      availablePallets += wAvailablePallets

      const usedSqFt = wTotalSqFt - wAvailableSqFt
      const usedPallets = wTotalPallets - wAvailablePallets

      return {
        id: warehouse.id,
        name: warehouse.name,
        city: warehouse.city || 'Unknown',
        totalSqFt: wTotalSqFt,
        availableSqFt: wAvailableSqFt,
        sqFtUtilization: wTotalSqFt > 0 ? (usedSqFt / wTotalSqFt) * 100 : 0,
        totalPallets: wTotalPallets,
        availablePallets: wAvailablePallets,
        palletUtilization: wTotalPallets > 0 ? (usedPallets / wTotalPallets) * 100 : 0,
        status: warehouse.status !== false,
      }
    })

    const usedSqFt = totalSqFt - availableSqFt
    const usedPallets = totalPallets - availablePallets

    const overall = {
      totalSqFt,
      usedSqFt,
      availableSqFt,
      sqFtUtilization: totalSqFt > 0 ? (usedSqFt / totalSqFt) * 100 : 0,
      totalPallets,
      usedPallets,
      availablePallets,
      palletUtilization: totalPallets > 0 ? (usedPallets / totalPallets) * 100 : 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        overall,
        warehouses: warehouseStats,
        utilizationTrend: [], // Can be populated with historical data if available
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching utilization data:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
