/**
 * Warehouse Listing Service
 * 
 * Handles CRUD operations for warehouse listings
 * Used by hosts to create and manage their warehouse listings
 */

import { prisma } from '@/lib/prisma/client'
import type { WarehouseListing } from '@/types/marketplace'

/**
 * Create a new warehouse listing
 */
export async function createWarehouseListing(data: {
  name: string
  address: string
  city: string
  state?: string
  zipCode: string
  latitude?: number
  longitude?: number
  totalSqFt: number
  totalPalletStorage?: number
  warehouseType: string
  storageType: string
  temperatureTypes: string[]
  amenities?: string[]
  photos?: string[]
  description?: string
  companyId?: string
}): Promise<{ id: string } | null> {
  try {
    const warehouse = await (prisma as any).warehouses.create({
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        zip_code: data.zipCode,
        latitude: data.latitude?.toString(),
        longitude: data.longitude?.toString(),
        total_sq_ft: data.totalSqFt,
        total_pallet_storage: data.totalPalletStorage,
        available_sq_ft: data.totalSqFt,
        available_pallet_storage: data.totalPalletStorage || 0,
        goods_type: data.warehouseType,
        storage_type: data.storageType,
        temperature_types: data.temperatureTypes,
        amenities: data.amenities || [],
        description: data.description,
        photos: data.photos || [],
        company_id: data.companyId,
        status: true,
      },
    })

    return { id: warehouse.id }
  } catch (error) {
    console.error('[warehouse-listing] Error creating warehouse:', error)
    return null
  }
}

/**
 * Update a warehouse listing
 */
export async function updateWarehouseListing(
  id: string,
  data: Partial<{
    name: string
    address: string
    city: string
    state: string
    zipCode: string
    latitude: number
    longitude: number
    totalSqFt: number
    totalPalletStorage: number
    warehouseType: string
    storageType: string
    temperatureTypes: string[]
    amenities: string[]
    photos: string[]
    description: string
    status: boolean
  }>
): Promise<boolean> {
  try {
    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.state !== undefined) updateData.state = data.state
    if (data.zipCode !== undefined) updateData.zip_code = data.zipCode
    if (data.latitude !== undefined) updateData.latitude = data.latitude.toString()
    if (data.longitude !== undefined) updateData.longitude = data.longitude.toString()
    if (data.totalSqFt !== undefined) updateData.total_sq_ft = data.totalSqFt
    if (data.totalPalletStorage !== undefined) updateData.total_pallet_storage = data.totalPalletStorage
    if (data.warehouseType !== undefined) updateData.goods_type = data.warehouseType
    if (data.storageType !== undefined) updateData.storage_type = data.storageType
    if (data.temperatureTypes !== undefined) updateData.temperature_types = data.temperatureTypes
    if (data.amenities !== undefined) updateData.amenities = data.amenities
    if (data.photos !== undefined) updateData.photos = data.photos
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status

    await (prisma as any).warehouses.update({
      where: { id },
      data: updateData,
    })

    return true
  } catch (error) {
    console.error('[warehouse-listing] Error updating warehouse:', error)
    return false
  }
}

/**
 * Get warehouse listing by ID
 */
export async function getWarehouseListing(id: string): Promise<WarehouseListing | null> {
  try {
    const warehouse = await (prisma as any).warehouses.findUnique({
      where: { id },
      include: {
        warehouse_pricing: true,
      },
    })

    if (!warehouse) return null

    return {
      id: warehouse.id,
      name: warehouse.name,
      address: warehouse.address,
      city: warehouse.city,
      state: warehouse.state,
      zipCode: warehouse.zip_code,
      latitude: warehouse.latitude ? parseFloat(warehouse.latitude) : undefined,
      longitude: warehouse.longitude ? parseFloat(warehouse.longitude) : undefined,
      totalSqFt: warehouse.total_sq_ft,
      totalPalletStorage: warehouse.total_pallet_storage,
      availableSqFt: warehouse.available_sq_ft,
      availablePalletStorage: warehouse.available_pallet_storage,
      warehouseType: warehouse.goods_type,
      storageType: warehouse.storage_type,
      temperatureTypes: warehouse.temperature_types || [],
      amenities: warehouse.amenities || [],
      description: warehouse.description || undefined,
      photos: warehouse.photos || [],
      status: warehouse.status,
      isVerified: warehouse.is_verified,
      pricing: (warehouse.warehouse_pricing || []).map((p: any) => ({
        id: p.id,
        warehouseId: p.warehouse_id,
        pricingType: p.pricing_type,
        basePrice: parseFloat(p.base_price),
        unit: p.unit,
        volumeDiscounts: p.volume_discounts || [],
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
      createdAt: warehouse.created_at,
      updatedAt: warehouse.updated_at,
      companyId: warehouse.company_id,
    }
  } catch (error) {
    console.error('[warehouse-listing] Error fetching warehouse:', error)
    return null
  }
}

/**
 * Delete a warehouse listing (soft delete by setting status to false)
 */
export async function deleteWarehouseListing(id: string): Promise<boolean> {
  try {
    await (prisma as any).warehouses.update({
      where: { id },
      data: { status: false },
    })

    return true
  } catch (error) {
    console.error('[warehouse-listing] Error deleting warehouse:', error)
    return false
  }
}

