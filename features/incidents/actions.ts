'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createIncidentSchema } from '@/lib/validation/schemas'
import type { Incident } from '@/types'
import type { CreateIncidentInput, UpdateIncidentInput, ResolveIncidentInput } from './types'

/**
 * Create a new incident
 */
export async function createIncidentAction(
  input: CreateIncidentInput
): Promise<{ success: boolean; data?: Incident; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Validate input
    const validatedData = createIncidentSchema.parse(input)

    // Create incident
    const incidentRow = {
      type: validatedData.type,
      title: validatedData.title,
      description: validatedData.description,
      severity: validatedData.severity,
      status: 'open',
      reported_by: user.id,
      reported_by_name: profile.name || user.email,
      warehouse_id: validatedData.warehouseId,
      location: validatedData.location ?? null,
      affected_booking_id: validatedData.affectedBookingId ?? null,
    }

    const { data, error } = await supabase
      .from('incidents')
      .insert(incidentRow)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/admin/incidents')
    revalidatePath('/worker/incidents')

    return {
      success: true,
      data: transformIncidentRow(data),
    }
  } catch (error) {
    console.error('Create incident error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create incident',
    }
  }
}

/**
 * Update an existing incident
 */
export async function updateIncidentAction(
  id: string,
  input: UpdateIncidentInput
): Promise<{ success: boolean; data?: Incident; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Only admins can update incidents' }
    }

    // Build update object
    const updateRow: Record<string, any> = {}
    if (input.status !== undefined) updateRow.status = input.status
    if (input.severity !== undefined) updateRow.severity = input.severity
    if (input.resolution !== undefined) updateRow.resolution = input.resolution
    if (input.resolvedAt !== undefined) updateRow.resolved_at = input.resolvedAt

    const { data, error } = await supabase
      .from('incidents')
      .update(updateRow)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/admin/incidents')
    revalidatePath('/worker/incidents')

    return {
      success: true,
      data: transformIncidentRow(data),
    }
  } catch (error) {
    console.error('Update incident error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update incident',
    }
  }
}

/**
 * Resolve an incident
 */
export async function resolveIncidentAction(
  input: ResolveIncidentInput
): Promise<{ success: boolean; data?: Incident; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Only admins can resolve incidents' }
    }

    const { data, error } = await supabase
      .from('incidents')
      .update({
        status: 'resolved',
        resolution: input.resolution,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', input.incidentId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/admin/incidents')
    revalidatePath('/worker/incidents')

    return {
      success: true,
      data: transformIncidentRow(data),
    }
  } catch (error) {
    console.error('Resolve incident error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve incident',
    }
  }
}

/**
 * Delete an incident
 */
export async function deleteIncidentAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Only admins can delete incidents' }
    }

    const { error } = await supabase.from('incidents').delete().eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/admin/incidents')
    revalidatePath('/worker/incidents')

    return { success: true }
  } catch (error) {
    console.error('Delete incident error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete incident',
    }
  }
}

/**
 * Transform database row to Incident type
 */
function transformIncidentRow(row: any): Incident {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    severity: row.severity,
    status: row.status,
    reportedBy: row.reported_by,
    reportedByName: row.reported_by_name,
    warehouseId: row.warehouse_id,
    location: row.location ?? undefined,
    affectedBookingId: row.affected_booking_id ?? undefined,
    resolution: row.resolution ?? undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  }
}

