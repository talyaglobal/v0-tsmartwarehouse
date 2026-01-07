import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface WarehouseService {
  id: string
  warehouse_id: string
  company_service_id?: string | null
  service_name: string
  service_description: string | null
  pricing_type: 'one_time' | 'per_pallet' | 'per_sqft' | 'per_day' | 'per_month'
  base_price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Get all services for a warehouse
 * @param warehouseId - The warehouse ID
 * @param includeInactive - Whether to include inactive services (default: false)
 */
export async function getWarehouseServices(
  warehouseId: string,
  includeInactive: boolean = false
): Promise<WarehouseService[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('warehouse_services')
    .select('*')
    .eq('warehouse_id', warehouseId)
    .eq('status', true) // Only get non-deleted services (soft delete)

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query.order('service_name', { ascending: true })

  if (error) {
    console.error('Error fetching warehouse services:', error)
    return []
  }

  return (data || []).map((service) => ({
    id: service.id,
    warehouse_id: service.warehouse_id,
    company_service_id: service.company_service_id || null,
    service_name: service.service_name,
    service_description: service.service_description,
    pricing_type: service.pricing_type,
    base_price: parseFloat(service.base_price),
    is_active: service.is_active,
    created_at: service.created_at,
    updated_at: service.updated_at,
  }))
}

