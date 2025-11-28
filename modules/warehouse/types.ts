import type { Address, OperatingHours } from "../common/types"

export interface Warehouse {
  id: string
  name: string
  code: string
  address: Address
  phone: string
  email: string
  manager_id: string
  capacity_sqft: number
  used_sqft: number
  operating_hours: OperatingHours
  amenities: string[]
  is_active: boolean
  created_at: string
}

export interface StorageUnit {
  id: string
  warehouse_id: string
  unit_number: string
  zone: string
  aisle: string
  rack: string
  level: string
  size_sqft: number
  height_ft: number
  max_weight_lbs: number
  is_climate_controlled: boolean
  is_available: boolean
  daily_rate: number
  monthly_rate: number
}

export interface WarehouseZone {
  id: string
  warehouse_id: string
  name: string
  code: string
  type: "storage" | "receiving" | "shipping" | "staging" | "returns"
  temperature_controlled: boolean
  min_temp?: number
  max_temp?: number
  capacity_sqft: number
}

export interface CreateWarehouseRequest {
  name: string
  code: string
  address: Address
  phone: string
  email: string
  manager_id: string
  capacity_sqft: number
  operating_hours: OperatingHours
  amenities: string[]
}

export interface UpdateWarehouseRequest {
  name?: string
  phone?: string
  email?: string
  manager_id?: string
  operating_hours?: OperatingHours
  amenities?: string[]
  is_active?: boolean
}
