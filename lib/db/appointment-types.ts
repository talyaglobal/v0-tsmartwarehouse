import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { AppointmentType } from '@/types'

/**
 * Database operations for Appointment Types
 */

export async function getAppointmentTypes(includeInactive = false): Promise<AppointmentType[]> {
  const supabase = createServerSupabaseClient()
  
  let query = supabase
    .from('appointment_types')
    .select('*')
    .order('name', { ascending: true })

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch appointment types: ${error.message}`)
  }

  return (data || []).map(mapAppointmentType)
}

export async function getAppointmentTypeById(id: string): Promise<AppointmentType | null> {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('appointment_types')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch appointment type: ${error.message}`)
  }

  return data ? mapAppointmentType(data) : null
}

export async function createAppointmentType(data: {
  name: string
  slug: string
  description?: string
  color: string
  icon?: string
  durationMinutes: number
  requiresWarehouseStaff: boolean
  isActive?: boolean
  createdBy: string
}): Promise<AppointmentType> {
  const supabase = createServerSupabaseClient()
  
  const { data: appointmentType, error } = await supabase
    .from('appointment_types')
    .insert({
      name: data.name,
      slug: data.slug,
      description: data.description,
      color: data.color,
      icon: data.icon,
      duration_minutes: data.durationMinutes,
      requires_warehouse_staff: data.requiresWarehouseStaff,
      is_active: data.isActive ?? true,
      created_by: data.createdBy,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create appointment type: ${error.message}`)
  }

  return mapAppointmentType(appointmentType)
}

export async function updateAppointmentType(
  id: string,
  data: {
    name?: string
    slug?: string
    description?: string
    color?: string
    icon?: string
    durationMinutes?: number
    requiresWarehouseStaff?: boolean
    isActive?: boolean
  }
): Promise<AppointmentType> {
  const supabase = createServerSupabaseClient()
  
  const updateData: Record<string, any> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.slug !== undefined) updateData.slug = data.slug
  if (data.description !== undefined) updateData.description = data.description
  if (data.color !== undefined) updateData.color = data.color
  if (data.icon !== undefined) updateData.icon = data.icon
  if (data.durationMinutes !== undefined) updateData.duration_minutes = data.durationMinutes
  if (data.requiresWarehouseStaff !== undefined) updateData.requires_warehouse_staff = data.requiresWarehouseStaff
  if (data.isActive !== undefined) updateData.is_active = data.isActive

  const { data: appointmentType, error } = await supabase
    .from('appointment_types')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update appointment type: ${error.message}`)
  }

  return mapAppointmentType(appointmentType)
}

export async function deleteAppointmentType(id: string): Promise<void> {
  // Soft delete by setting is_active to false
  await updateAppointmentType(id, { isActive: false })
}

function mapAppointmentType(row: any): AppointmentType {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    icon: row.icon,
    durationMinutes: row.duration_minutes,
    requiresWarehouseStaff: row.requires_warehouse_staff,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

