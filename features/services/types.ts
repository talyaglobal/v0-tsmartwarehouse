import type { ServiceCategory, WarehouseService } from '@/types'

export type { ServiceCategory, WarehouseService }

export interface ServiceFilters {
  category?: ServiceCategory
  isActive?: boolean
  limit?: number
  offset?: number
}

