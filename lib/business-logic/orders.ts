import type { WarehouseService } from '@/types'

/**
 * Business Logic: Service Orders
 * 
 * Functions for calculating order totals and validating order items
 */

/**
 * Calculate total amount for order items
 */
export function calculateOrderTotal(items: Array<{ quantity: number; unitPrice: number }>): number {
  return items.reduce((total, item) => {
    return total + (item.quantity * item.unitPrice)
  }, 0)
}

/**
 * Validate order items
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateOrderItems(
  items: Array<{ serviceId: string; quantity: number }>,
  services: WarehouseService[]
): ValidationResult {
  const errors: string[] = []

  if (items.length === 0) {
    errors.push('Order must have at least one item')
    return { valid: false, errors }
  }

  // Create a map of services for quick lookup
  const servicesMap = new Map(services.map(s => [s.id, s]))

  for (const item of items) {
    const service = servicesMap.get(item.serviceId)

    if (!service) {
      errors.push(`Service with ID ${item.serviceId} not found`)
      continue
    }

    if (!service.isActive) {
      errors.push(`Service "${service.name}" is not active`)
      continue
    }

    if (item.quantity < service.minQuantity) {
      errors.push(
        `Service "${service.name}" requires a minimum quantity of ${service.minQuantity}, but ${item.quantity} was provided`
      )
    }

    if (item.quantity <= 0) {
      errors.push(`Quantity for service "${service.name}" must be greater than 0`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Calculate item total price
 */
export function calculateItemTotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

