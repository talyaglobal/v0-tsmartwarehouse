import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { BookingType } from "@/types"

/**
 * Business Logic: Warehouse Capacity Management
 * 
 * Manages warehouse capacity for:
 * - Pallet storage (slots available)
 * - Area rentals (sq ft available)
 * - Real-time capacity checking
 * - Capacity reservation
 */

export interface CapacityCheck {
  available: boolean
  availableSlots?: number
  availableSqFt?: number
  requiredSlots?: number
  requiredSqFt?: number
  message: string
}

export interface WarehouseCapacity {
  totalSlots: number
  occupiedSlots: number
  availableSlots: number
  utilizationPercent: number
  totalSqFt: number
  occupiedSqFt: number
  availableSqFt: number
  utilizationSqFtPercent: number
}

/**
 * Check if warehouse has capacity for a pallet booking
 */
export async function checkPalletCapacity(
  _warehouseId: string,
  requiredPallets: number,
  zoneType?: "pallet" | "cold-storage" | "hazmat"
): Promise<CapacityCheck> {
  const supabase = createServerSupabaseClient()

  // Get total capacity from zones
  const { data: zones, error: zonesError } = await supabase
    .from("warehouse_zones")
    .select("total_slots, available_slots, type")
    .eq("type", zoneType || "pallet")

  if (zonesError) {
    throw new Error(`Failed to fetch zones: ${zonesError.message}`)
  }

  const availableSlots = zones?.reduce((sum, zone) => sum + (zone.available_slots || 0), 0) || 0

  // Check if we have enough capacity
  const hasCapacity = availableSlots >= requiredPallets

  return {
    available: hasCapacity,
    availableSlots,
    requiredSlots: requiredPallets,
    message: hasCapacity
      ? `Capacity available: ${availableSlots} slots free`
      : `Insufficient capacity: Need ${requiredPallets} slots, only ${availableSlots} available`,
  }
}

/**
 * Check if warehouse has capacity for an area rental booking
 */
export async function checkAreaRentalCapacity(
  warehouseId: string,
  requiredSqFt: number,
  floorNumber?: 3
): Promise<CapacityCheck> {
  const supabase = createServerSupabaseClient()

  // Area rentals are only on floor 3
  const targetFloor = floorNumber || 3

  if (targetFloor !== 3) {
    return {
      available: false,
      message: "Area rentals are only available on Floor 3",
    }
  }

  // Get floor 3 halls
  const { data: floors, error: floorsError } = await supabase
    .from("warehouse_floors")
    .select("id")
    .eq("warehouse_id", warehouseId)
    .eq("floor_number", targetFloor)
    .single()

  if (floorsError || !floors) {
    throw new Error(`Failed to fetch floor: ${floorsError?.message}`)
  }

  // Get halls on floor 3
  const { data: halls, error: hallsError } = await supabase
    .from("warehouse_halls")
    .select("sq_ft, available_sq_ft, occupied_sq_ft")
    .eq("floor_id", floors.id)

  if (hallsError) {
    throw new Error(`Failed to fetch halls: ${hallsError.message}`)
  }

  const availableSqFt = halls?.reduce((sum, hall) => sum + hall.available_sq_ft, 0) || 0

  // Check if we have enough capacity
  const hasCapacity = availableSqFt >= requiredSqFt

  return {
    available: hasCapacity,
    availableSqFt,
    requiredSqFt,
    message: hasCapacity
      ? `Capacity available: ${availableSqFt.toLocaleString()} sq ft free on Floor 3`
      : `Insufficient capacity: Need ${requiredSqFt.toLocaleString()} sq ft, only ${availableSqFt.toLocaleString()} available`,
  }
}

/**
 * Get overall warehouse capacity statistics
 */
export async function getWarehouseCapacity(
  warehouseId: string
): Promise<WarehouseCapacity> {
  const supabase = createServerSupabaseClient()

  // Get all zones for pallet capacity
  const { data: zones, error: zonesError } = await supabase
    .from("warehouse_zones")
    .select("total_slots, available_slots")
    .in("type", ["pallet", "cold-storage", "hazmat"])

  if (zonesError) {
    throw new Error(`Failed to fetch zones: ${zonesError.message}`)
  }

  const totalSlots = zones?.reduce((sum, zone) => sum + (zone.total_slots || 0), 0) || 0
  const availableSlots = zones?.reduce((sum, zone) => sum + (zone.available_slots || 0), 0) || 0
  const occupiedSlots = totalSlots - availableSlots

  // Get all halls for area capacity
  // First get floors, then halls
  const { data: floors } = await supabase
    .from("warehouse_floors")
    .select("id")
    .eq("warehouse_id", warehouseId)

  if (!floors || floors.length === 0) {
    throw new Error("No floors found for warehouse")
  }

  const floorIds = floors.map((f) => f.id)

  const { data: allHalls, error: allHallsError } = await supabase
    .from("warehouse_halls")
    .select("sq_ft, available_sq_ft, occupied_sq_ft")
    .in("floor_id", floorIds)

  if (allHallsError) {
    throw new Error(`Failed to fetch halls: ${allHallsError.message}`)
  }

  const totalSqFt = allHalls?.reduce((sum, hall) => sum + hall.sq_ft, 0) || 0
  const occupiedSqFt = allHalls?.reduce((sum, hall) => sum + hall.occupied_sq_ft, 0) || 0
  const availableSqFt = allHalls?.reduce((sum, hall) => sum + hall.available_sq_ft, 0) || 0

  return {
    totalSlots,
    occupiedSlots,
    availableSlots,
    utilizationPercent: totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0,
    totalSqFt,
    occupiedSqFt,
    availableSqFt,
    utilizationSqFtPercent: totalSqFt > 0 ? (occupiedSqFt / totalSqFt) * 100 : 0,
  }
}

/**
 * Reserve capacity for a booking (update available slots/sq ft)
 * This should be called when a booking is confirmed
 */
export async function reserveCapacity(
  _warehouseId: string,
  type: BookingType,
  amount: number, // pallet count or sq ft
  hallId?: string
): Promise<void> {
  const supabase = createServerSupabaseClient()

  if (type === "pallet") {
    // Update zone capacity
    // Find appropriate zone and update available_slots
    const { data: zones, error: zonesError } = await supabase
      .from("warehouse_zones")
      .select("id, available_slots")
      .eq("type", "pallet")
      .gte("available_slots", amount)
      .order("available_slots", { ascending: false })
      .limit(1)

    if (zonesError || !zones || zones.length === 0) {
      throw new Error("No available zones with sufficient capacity")
    }

    const zone = zones[0]
    const newAvailableSlots = (zone.available_slots || 0) - amount

    const { error: updateError } = await supabase
      .from("warehouse_zones")
      .update({ available_slots: newAvailableSlots })
      .eq("id", zone.id)

    if (updateError) {
      throw new Error(`Failed to reserve capacity: ${updateError.message}`)
    }
  } else if (type === "area-rental" && hallId) {
    // Update hall capacity
    const { data: hall, error: hallError } = await supabase
      .from("warehouse_halls")
      .select("available_sq_ft, occupied_sq_ft")
      .eq("id", hallId)
      .single()

    if (hallError || !hall) {
      throw new Error(`Failed to fetch hall: ${hallError?.message}`)
    }

    if (hall.available_sq_ft < amount) {
      throw new Error("Insufficient capacity in selected hall")
    }

    const newAvailableSqFt = hall.available_sq_ft - amount
    const newOccupiedSqFt = hall.occupied_sq_ft + amount

    const { error: updateError } = await supabase
      .from("warehouse_halls")
      .update({
        available_sq_ft: newAvailableSqFt,
        occupied_sq_ft: newOccupiedSqFt,
      })
      .eq("id", hallId)

    if (updateError) {
      throw new Error(`Failed to reserve capacity: ${updateError.message}`)
    }
  }
}

/**
 * Release capacity when a booking is cancelled or completed
 */
export async function releaseCapacity(
  _warehouseId: string,
  type: BookingType,
  amount: number,
  hallId?: string,
  zoneId?: string
): Promise<void> {
  const supabase = createServerSupabaseClient()

  if (type === "pallet" && zoneId) {
    const { data: zone, error: zoneError } = await supabase
      .from("warehouse_zones")
      .select("available_slots, total_slots")
      .eq("id", zoneId)
      .single()

    if (zoneError || !zone) {
      throw new Error(`Failed to fetch zone: ${zoneError?.message}`)
    }

    const newAvailableSlots = Math.min(
      (zone.available_slots || 0) + amount,
      zone.total_slots || 0
    )

    const { error: updateError } = await supabase
      .from("warehouse_zones")
      .update({ available_slots: newAvailableSlots })
      .eq("id", zoneId)

    if (updateError) {
      throw new Error(`Failed to release capacity: ${updateError.message}`)
    }
  } else if (type === "area-rental" && hallId) {
    const { data: hall, error: hallError } = await supabase
      .from("warehouse_halls")
      .select("available_sq_ft, occupied_sq_ft")
      .eq("id", hallId)
      .single()

    if (hallError || !hall) {
      throw new Error(`Failed to fetch hall: ${hallError?.message}`)
    }

    const newAvailableSqFt = hall.available_sq_ft + amount
    const newOccupiedSqFt = Math.max(0, hall.occupied_sq_ft - amount)

    const { error: updateError } = await supabase
      .from("warehouse_halls")
      .update({
        available_sq_ft: newAvailableSqFt,
        occupied_sq_ft: newOccupiedSqFt,
      })
      .eq("id", hallId)

    if (updateError) {
      throw new Error(`Failed to release capacity: ${updateError.message}`)
    }
  }
}

