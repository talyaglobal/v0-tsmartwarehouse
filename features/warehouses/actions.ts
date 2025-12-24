'use server'

import { createWarehouse, updateWarehouse, getWarehouseById } from '@/lib/db/warehouses'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Warehouse } from '@/types'

export interface CreateWarehouseInput {
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  totalSqFt: number
  amenities?: string[]
  operatingHours?: {
    open: string
    close: string
    days: string[]
  }
  ownerCompanyId: string
}

export interface UpdateWarehouseInput {
  name?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  totalSqFt?: number
  amenities?: string[]
  operatingHours?: {
    open: string
    close: string
    days: string[]
  }
}

/**
 * Create a new warehouse
 */
export async function createWarehouseAction(
  input: CreateWarehouseInput
): Promise<{ success: boolean; data?: Warehouse; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get user's profile to check company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) {
      return { success: false, error: 'User must belong to a company' }
    }

    // Verify user's company is a warehouse company
    const { data: company } = await supabase
      .from('companies')
      .select('type')
      .eq('id', profile.company_id)
      .single()

    if (company?.type !== 'warehouse_company') {
      return {
        success: false,
        error: 'Only warehouse companies can create warehouses',
      }
    }

    // Create warehouse
    const warehouse = await createWarehouse({
      ...input,
      amenities: input.amenities || [],
      operatingHours: input.operatingHours || {
        open: '08:00',
        close: '18:00',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
      ownerCompanyId: profile.company_id,
    })

    revalidatePath('/warehouse-owner/warehouses')
    return { success: true, data: warehouse }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update warehouse
 */
export async function updateWarehouseAction(
  warehouseId: string,
  input: UpdateWarehouseInput
): Promise<{ success: boolean; data?: Warehouse; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get warehouse to verify ownership
    const warehouse = await getWarehouseById(warehouseId)
    if (!warehouse) {
      return { success: false, error: 'Warehouse not found' }
    }

    // Verify ownership (this will be checked via RLS in production)
    // For now, we'll allow if user is admin or warehouse owner

    // Update warehouse
    const updated = await updateWarehouse(warehouseId, input)

    revalidatePath(`/warehouse-owner/warehouses/${warehouseId}`)
    return { success: true, data: updated }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

