'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface FloorPlanData {
  vertices: { x: number; y: number }[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wallOpenings?: any[]
  wallHeight?: number
  totalArea?: number
  equipmentArea?: number
  palletCapacity?: number
  floorNumber?: number
  name?: string
  zoom?: number
  panX?: number
  panY?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  areas?: any[]
}

interface FloorPlanResult {
  success: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
  error?: string
}

interface FloorInfo {
  id: string
  floorNumber: number
  name: string
  updatedAt: string
}

// Save a floor plan for a specific floor number
export async function saveFloorPlan(
  warehouseId: string, 
  data: FloorPlanData, 
  floorNumber: number = 1
): Promise<FloorPlanResult> {
  try {
    const supabase = await createClient()
    
    // Get current user (don't throw if not authenticated)
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id || null

    // Prepare the data
    const floorPlanData = {
      warehouse_id: warehouseId,
      floor_number: floorNumber,
      name: data.name || `Floor ${floorNumber}`,
      vertices: data.vertices || [],
      items: data.items || [],
      wall_openings: data.wallOpenings || [],
      wall_height: data.wallHeight || 20,
      total_area: data.totalArea || 0,
      equipment_area: data.equipmentArea || 0,
      pallet_capacity: data.palletCapacity || 0,
      zoom: data.zoom || 1,
      pan_x: data.panX || 0,
      pan_y: data.panY || 0,
      areas: data.areas || [],
      updated_at: new Date().toISOString()
    }

    // Check if floor plan exists for this warehouse and floor number
    const { data: existing, error: checkError } = await supabase
      .from('floor_plans')
      .select('id')
      .eq('warehouse_id', warehouseId)
      .eq('floor_number', floorNumber)
      .maybeSingle()

    if (checkError) {
      console.error('Check error:', checkError)
      // If table doesn't exist
      if (checkError.code === '42P01') {
        return { success: false, error: 'floor_plans table does not exist. Please run the migration.' }
      }
      // Continue anyway - might just be no data
    }

    let result

    if (existing) {
      // Update existing floor plan
      result = await supabase
        .from('floor_plans')
        .update(floorPlanData)
        .eq('warehouse_id', warehouseId)
        .eq('floor_number', floorNumber)
        .select()
        .single()
    } else {
      // Insert new floor plan
      result = await supabase
        .from('floor_plans')
        .insert({
          ...floorPlanData,
          created_by: userId,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Save error:', result.error)
      return { success: false, error: result.error.message }
    }

    revalidatePath(`/dashboard/warehouses/${warehouseId}/floor-plan`)
    
    return { success: true, data: result.data }
  } catch (error) {
    console.error('saveFloorPlan error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Load a specific floor plan by floor number
export async function loadFloorPlan(
  warehouseId: string, 
  floorNumber: number = 1
): Promise<FloorPlanResult> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('floor_plans')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('floor_number', floorNumber)
      .maybeSingle()

    if (error) {
      // Table might not exist
      if (error.code === '42P01') {
        return { success: true, data: null }
      }
      console.error('Load error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('loadFloorPlan error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Load all floors for a warehouse (returns list of floor numbers and names)
export async function loadAllFloors(warehouseId: string): Promise<{
  success: boolean
  floors?: FloorInfo[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('floor_plans')
      .select('id, floor_number, name, updated_at')
      .eq('warehouse_id', warehouseId)
      .order('floor_number', { ascending: true })

    if (error) {
      // Table might not exist
      if (error.code === '42P01') {
        return { success: true, floors: [] }
      }
      console.error('Load all floors error:', error)
      return { success: false, error: error.message }
    }

    const floors: FloorInfo[] = (data || []).map(f => ({
      id: f.id,
      floorNumber: f.floor_number,
      name: f.name || `Floor ${f.floor_number}`,
      updatedAt: f.updated_at
    }))

    return { success: true, floors }
  } catch (error) {
    console.error('loadAllFloors error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Delete a specific floor
export async function deleteFloor(
  warehouseId: string, 
  floorNumber: number
): Promise<FloorPlanResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('floor_plans')
      .delete()
      .eq('warehouse_id', warehouseId)
      .eq('floor_number', floorNumber)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath(`/dashboard/warehouses/${warehouseId}/floor-plan`)
    
    return { success: true }
  } catch (error) {
    console.error('deleteFloor error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Delete all floors for a warehouse
export async function deleteFloorPlan(warehouseId: string): Promise<FloorPlanResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('floor_plans')
      .delete()
      .eq('warehouse_id', warehouseId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath(`/dashboard/warehouses/${warehouseId}/floor-plan`)
    
    return { success: true }
  } catch (error) {
    console.error('deleteFloorPlan error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
