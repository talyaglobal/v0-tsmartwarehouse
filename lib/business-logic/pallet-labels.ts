/**
 * Business Logic: Pallet Labels
 * 
 * Handles:
 * - Gathering all traceability data for label generation
 * - Formatting label data for display/printing
 * - Validating required fields for label generation
 */

import { getInventoryItemById } from '@/lib/db/inventory'
import { getBookingById } from '@/lib/db/bookings'
import {
  getWarehouseById,
  getWarehouseFloorById,
  getWarehouseHallById,
  getWarehouseZoneById,
  getWarehouseRegionById,
} from '@/lib/db/warehouses'
import type { PalletLabelData } from '@/types'

/**
 * Generate complete pallet label data with full traceability
 */
export async function generatePalletLabelData(
  inventoryItemId: string
): Promise<PalletLabelData> {
  // Get inventory item
  const item = await getInventoryItemById(inventoryItemId)

  // Get booking information
  const booking = await getBookingById(item.booking_id)

  // Get warehouse information
  await getWarehouseById(item.warehouse_id)

  // Fetch full location hierarchy
  let floor = null
  let region = null
  let hall = null
  let zone = null

  if (item.floor_id) {
    const floorData = await getWarehouseFloorById(item.floor_id)
    if (floorData) {
      floor = {
        id: floorData.id,
        floorNumber: floorData.floorNumber,
        name: floorData.name,
      }
    }
  }

  if (item.region_id) {
    const regionData = await getWarehouseRegionById(item.region_id)
    if (regionData) {
      region = {
        id: regionData.id,
        name: regionData.name,
      }
    }
  }

  if (item.hall_id) {
    const hallData = await getWarehouseHallById(item.hall_id)
    if (hallData) {
      hall = {
        id: hallData.id,
        hallName: hallData.hallName,
      }
    }
  }

  if (item.zone_id) {
    const zoneData = await getWarehouseZoneById(item.zone_id)
    if (zoneData) {
      zone = {
        id: zoneData.id,
        name: zoneData.name,
        type: zoneData.type,
      }
    }
  }

  // Calculate storage duration
  const days = item.days_in_warehouse || 0
  const months = item.months_in_warehouse || 0

  // Build location object with full hierarchy
  const location: PalletLabelData['location'] = {
    floor: floor || undefined,
    region: region || undefined,
    hall: hall || undefined,
    zone: zone || undefined,
    locationCode: item.location_code || undefined,
    rowNumber: item.row_number || undefined,
    levelNumber: item.level_number || undefined,
  }

  // Construct label data
  const labelData: PalletLabelData = {
    // Identification
    warehouseTrackingNumber: item.warehouse_tracking_number || item.pallet_id,
    palletId: item.pallet_id,
    barcode: item.barcode || undefined,
    qrCode: item.qr_code || undefined,

    // Customer Information
    customerName: booking?.customerName || 'Unknown',
    customerEmail: booking?.customerEmail || '',
    customerLotNumber: item.customer_lot_number || undefined,
    customerBatchNumber: item.customer_batch_number || undefined,

    // Dates
    arrivalDate: item.received_date || item.received_at?.split('T')[0] || '',
    expectedReleaseDate: item.expected_release_date || booking?.endDate || undefined,
    daysInWarehouse: days,
    monthsInWarehouse: months,

    // Stock Information
    stockDefinition: item.stock_definition || item.description || undefined,
    numberOfCases: item.number_of_cases || undefined,
    numberOfUnits: item.number_of_units || undefined,
    unitType: item.unit_type || undefined,
    hsCode: item.hs_code || undefined,

    // Storage Requirements
    storageRequirements: item.storage_requirements || undefined,

    // Location
    location,

    // Additional
    status: item.status,
    itemType: item.item_type || undefined,
    weightKg: item.weight_kg || undefined,
    dimensions: item.dimensions || undefined,
    notes: item.notes || undefined,
  }

  return labelData
}

/**
 * Format label data for display/printing
 */
export function formatLabelData(labelData: PalletLabelData): {
  formatted: Record<string, string>
  sections: Array<{ title: string; fields: Array<{ label: string; value: string }> }>
} {
  const formatted: Record<string, string> = {}
  const sections: Array<{ title: string; fields: Array<{ label: string; value: string }> }> = []

  // Identification Section
  sections.push({
    title: 'Identification',
    fields: [
      { label: 'Warehouse Tracking', value: labelData.warehouseTrackingNumber },
      { label: 'Pallet ID', value: labelData.palletId },
    ],
  })

  // Customer Section
  sections.push({
    title: 'Customer Information',
    fields: [
      { label: 'Customer', value: labelData.customerName },
      { label: 'Email', value: labelData.customerEmail },
      ...(labelData.customerLotNumber
        ? [{ label: 'Lot Number', value: labelData.customerLotNumber }]
        : []),
      ...(labelData.customerBatchNumber
        ? [{ label: 'Batch Number', value: labelData.customerBatchNumber }]
        : []),
    ],
  })

  // Dates Section
  sections.push({
    title: 'Dates',
    fields: [
      { label: 'Arrival Date', value: labelData.arrivalDate },
      ...(labelData.expectedReleaseDate
        ? [{ label: 'Expected Release', value: labelData.expectedReleaseDate }]
        : []),
      { label: 'Days in Warehouse', value: labelData.daysInWarehouse.toString() },
      { label: 'Months in Warehouse', value: labelData.monthsInWarehouse.toFixed(2) },
    ],
  })

  // Stock Information Section
  if (labelData.stockDefinition || labelData.numberOfCases || labelData.hsCode) {
    sections.push({
      title: 'Stock Information',
      fields: [
        ...(labelData.stockDefinition
          ? [{ label: 'Stock Definition', value: labelData.stockDefinition }]
          : []),
        ...(labelData.numberOfCases
          ? [{ label: 'Cases', value: labelData.numberOfCases.toString() }]
          : []),
        ...(labelData.numberOfUnits
          ? [
              {
                label: 'Units',
                value: `${labelData.numberOfUnits} ${labelData.unitType || ''}`,
              },
            ]
          : []),
        ...(labelData.hsCode ? [{ label: 'HS Code', value: labelData.hsCode }] : []),
      ],
    })
  }

  // Location Section
  if (labelData.location.locationCode) {
    sections.push({
      title: 'Location',
      fields: [{ label: 'Location Code', value: labelData.location.locationCode }],
    })
  }

  // Storage Requirements Section
  if (labelData.storageRequirements && labelData.storageRequirements.length > 0) {
    sections.push({
      title: 'Storage Requirements',
      fields: labelData.storageRequirements.map((req) => ({ label: '', value: `• ${req}` })),
    })
  }

  return { formatted, sections }
}

/**
 * Validate all required fields for label generation
 */
export function validateLabelData(labelData: PalletLabelData): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!labelData.warehouseTrackingNumber) {
    errors.push('Warehouse tracking number is required')
  }

  if (!labelData.customerName) {
    errors.push('Customer name is required')
  }

  if (!labelData.arrivalDate) {
    errors.push('Arrival date is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

