import type { Warehouse, StorageUnit } from "../../warehouse/types"

export interface CapacityInfo {
  total_sqft: number
  used_sqft: number
  available_sqft: number
  utilization_percent: number
  available_units: number
  total_units: number
}

export interface AvailabilitySlot {
  date: string
  available_sqft: number
  is_available: boolean
}

export class CapacityService {
  private static instance: CapacityService

  static getInstance(): CapacityService {
    if (!CapacityService.instance) {
      CapacityService.instance = new CapacityService()
    }
    return CapacityService.instance
  }

  calculateWarehouseCapacity(warehouse: Warehouse, units: StorageUnit[]): CapacityInfo {
    const warehouseUnits = units.filter((u) => u.warehouse_id === warehouse.id)
    const availableUnits = warehouseUnits.filter((u) => u.is_available)

    return {
      total_sqft: warehouse.capacity_sqft,
      used_sqft: warehouse.used_sqft,
      available_sqft: warehouse.capacity_sqft - warehouse.used_sqft,
      utilization_percent: (warehouse.used_sqft / warehouse.capacity_sqft) * 100,
      available_units: availableUnits.length,
      total_units: warehouseUnits.length,
    }
  }

  checkAvailability(warehouseId: string, requiredSqft: number, startDate: string, endDate?: string): boolean {
    // Mock implementation - in real app, would check against bookings
    return true
  }

  getAvailabilitySlots(warehouseId: string, requiredSqft: number, startDate: string, days: number): AvailabilitySlot[] {
    const slots: AvailabilitySlot[] = []
    const start = new Date(startDate)

    for (let i = 0; i < days; i++) {
      const date = new Date(start)
      date.setDate(date.getDate() + i)

      slots.push({
        date: date.toISOString().split("T")[0],
        available_sqft: 5000 - Math.floor(Math.random() * 2000),
        is_available: Math.random() > 0.2,
      })
    }

    return slots
  }

  reserveCapacity(warehouseId: string, sqft: number, startDate: string, endDate?: string): string {
    // Mock implementation - return reservation ID
    return `res-${Date.now()}`
  }

  releaseCapacity(reservationId: string): void {
    // Mock implementation
  }
}

export const capacityService = CapacityService.getInstance()
