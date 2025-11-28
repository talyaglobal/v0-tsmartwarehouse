import type { Warehouse, StorageUnit, CreateWarehouseRequest, UpdateWarehouseRequest } from "../types"
import type { PaginatedResponse, PaginationParams } from "../../common/types"

// Mock data
const warehouses: Warehouse[] = [
  {
    id: "wh-001",
    name: "TSmart Main Facility",
    code: "TSM-NYC-01",
    address: {
      street: "100 Warehouse Way",
      city: "Brooklyn",
      state: "NY",
      postal_code: "11201",
      country: "USA",
      lat: 40.6892,
      lng: -73.9857,
    },
    phone: "+1 (555) 100-0001",
    email: "nyc@tsmartwarehouse.com",
    manager_id: "admin-002",
    capacity_sqft: 150000,
    used_sqft: 112500,
    operating_hours: {
      monday: { open: "06:00", close: "22:00", is_closed: false },
      tuesday: { open: "06:00", close: "22:00", is_closed: false },
      wednesday: { open: "06:00", close: "22:00", is_closed: false },
      thursday: { open: "06:00", close: "22:00", is_closed: false },
      friday: { open: "06:00", close: "22:00", is_closed: false },
      saturday: { open: "08:00", close: "18:00", is_closed: false },
      sunday: { open: "08:00", close: "18:00", is_closed: true },
    },
    amenities: ["Climate Control", "24/7 Security", "Loading Docks", "Forklift Service"],
    is_active: true,
    created_at: "2023-01-01T00:00:00Z",
  },
  {
    id: "wh-002",
    name: "TSmart West Coast Hub",
    code: "TSM-LA-01",
    address: {
      street: "500 Distribution Drive",
      city: "Los Angeles",
      state: "CA",
      postal_code: "90058",
      country: "USA",
      lat: 33.9425,
      lng: -118.2551,
    },
    phone: "+1 (555) 200-0001",
    email: "la@tsmartwarehouse.com",
    manager_id: "admin-001",
    capacity_sqft: 200000,
    used_sqft: 160000,
    operating_hours: {
      monday: { open: "05:00", close: "23:00", is_closed: false },
      tuesday: { open: "05:00", close: "23:00", is_closed: false },
      wednesday: { open: "05:00", close: "23:00", is_closed: false },
      thursday: { open: "05:00", close: "23:00", is_closed: false },
      friday: { open: "05:00", close: "23:00", is_closed: false },
      saturday: { open: "06:00", close: "20:00", is_closed: false },
      sunday: { open: "06:00", close: "20:00", is_closed: false },
    },
    amenities: ["Climate Control", "24/7 Security", "Rail Access", "Cross-Docking"],
    is_active: true,
    created_at: "2023-03-15T00:00:00Z",
  },
]

const storageUnits: StorageUnit[] = [
  {
    id: "unit-001",
    warehouse_id: "wh-001",
    unit_number: "A-101",
    zone: "A",
    aisle: "1",
    rack: "01",
    level: "1",
    size_sqft: 100,
    height_ft: 12,
    max_weight_lbs: 5000,
    is_climate_controlled: true,
    is_available: false,
    daily_rate: 15,
    monthly_rate: 350,
  },
  {
    id: "unit-002",
    warehouse_id: "wh-001",
    unit_number: "A-102",
    zone: "A",
    aisle: "1",
    rack: "02",
    level: "1",
    size_sqft: 150,
    height_ft: 12,
    max_weight_lbs: 7500,
    is_climate_controlled: true,
    is_available: true,
    daily_rate: 22,
    monthly_rate: 500,
  },
  {
    id: "unit-003",
    warehouse_id: "wh-001",
    unit_number: "B-201",
    zone: "B",
    aisle: "2",
    rack: "01",
    level: "2",
    size_sqft: 200,
    height_ft: 15,
    max_weight_lbs: 10000,
    is_climate_controlled: false,
    is_available: true,
    daily_rate: 25,
    monthly_rate: 600,
  },
]

export class WarehouseService {
  private static instance: WarehouseService

  static getInstance(): WarehouseService {
    if (!WarehouseService.instance) {
      WarehouseService.instance = new WarehouseService()
    }
    return WarehouseService.instance
  }

  async getWarehouses(pagination?: PaginationParams): Promise<PaginatedResponse<Warehouse>> {
    const page = pagination?.page ?? 1
    const limit = pagination?.limit ?? 10
    const start = (page - 1) * limit
    const end = start + limit

    return {
      data: warehouses.slice(start, end),
      total: warehouses.length,
      page,
      limit,
      totalPages: Math.ceil(warehouses.length / limit),
    }
  }

  async getWarehouseById(id: string): Promise<Warehouse | null> {
    return warehouses.find((w) => w.id === id) ?? null
  }

  async getActiveWarehouses(): Promise<Warehouse[]> {
    return warehouses.filter((w) => w.is_active)
  }

  async createWarehouse(data: CreateWarehouseRequest): Promise<Warehouse> {
    const newWarehouse: Warehouse = {
      id: `wh-${Date.now()}`,
      ...data,
      used_sqft: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    }
    warehouses.push(newWarehouse)
    return newWarehouse
  }

  async updateWarehouse(id: string, data: UpdateWarehouseRequest): Promise<Warehouse | null> {
    const index = warehouses.findIndex((w) => w.id === id)
    if (index === -1) return null

    warehouses[index] = { ...warehouses[index], ...data }
    return warehouses[index]
  }

  async getStorageUnits(warehouseId: string): Promise<StorageUnit[]> {
    return storageUnits.filter((u) => u.warehouse_id === warehouseId)
  }

  async getAvailableUnits(warehouseId: string): Promise<StorageUnit[]> {
    return storageUnits.filter((u) => u.warehouse_id === warehouseId && u.is_available)
  }

  async getStorageUnitById(id: string): Promise<StorageUnit | null> {
    return storageUnits.find((u) => u.id === id) ?? null
  }
}

export const warehouseService = WarehouseService.getInstance()
