import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface WarehouseService {
  id: string
  warehouse_id: string
  service_name: string
  service_description: string | null
  pricing_type: 'one_time' | 'per_pallet' | 'per_sqft' | 'per_day' | 'per_month'
  base_price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Get all active services for a warehouse
 */
export async function getWarehouseServices(warehouseId: string): Promise<WarehouseService[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('warehouse_services')
    .select('*')
    .eq('warehouse_id', warehouseId)
    .eq('is_active', true)
    .order('service_name', { ascending: true })

  if (error) {
    console.error('Error fetching warehouse services:', error)
    return []
  }

  return (data || []).map((service) => ({
    id: service.id,
    warehouse_id: service.warehouse_id,
    service_name: service.service_name,
    service_description: service.service_description,
    pricing_type: service.pricing_type,
    base_price: parseFloat(service.base_price),
    is_active: service.is_active,
    created_at: service.created_at,
    updated_at: service.updated_at,
  }))
}

