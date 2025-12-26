import { getServices, getServiceById } from '@/lib/db/services'
import type { ServiceCategory } from '@/types'

export async function fetchServices(filters?: {
  category?: ServiceCategory
  isActive?: boolean
}) {
  return getServices({
    category: filters?.category,
    isActive: filters?.isActive ?? true,
  })
}

export async function fetchServiceById(id: string) {
  return getServiceById(id)
}

