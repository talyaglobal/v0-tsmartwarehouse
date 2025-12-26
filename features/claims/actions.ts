'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createClaimSchema } from '@/lib/validation/schemas'
import type { Claim } from '@/types'
import type { CreateClaimInput, UpdateClaimInput, ApproveClaimInput, RejectClaimInput } from './types'

/**
 * Create a new claim
 */
export async function createClaimAction(
  input: CreateClaimInput
): Promise<{ success: boolean; data?: Claim; error?: string }> {
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
    const validatedData = createClaimSchema.parse(input)

    // Create claim
    const claimRow = {
      customer_id: user.id,
      customer_name: profile.name || user.email,
      incident_id: validatedData.incidentId ?? null,
      booking_id: validatedData.bookingId,
      type: validatedData.type,
      description: validatedData.description,
      amount: validatedData.amount,
      status: 'submitted',
      evidence: validatedData.evidenceFiles ? JSON.stringify(validatedData.evidenceFiles) : null,
    }

    const { data, error } = await supabase
      .from('claims')
      .insert(claimRow)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/dashboard/claims')
    revalidatePath('/admin/claims')
    revalidatePath(`/dashboard/bookings/${validatedData.bookingId}`)

    return {
      success: true,
      data: transformClaimRow(data),
    }
  } catch (error) {
    console.error('Create claim error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create claim',
    }
  }
}

/**
 * Update an existing claim
 */
export async function updateClaimAction(
  id: string,
  input: UpdateClaimInput
): Promise<{ success: boolean; data?: Claim; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is admin or the claim owner
    const { data: claim } = await supabase
      .from('claims')
      .select('customer_id')
      .eq('id', id)
      .single()

    if (!claim) {
      return { success: false, error: 'Claim not found' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (claim.customer_id !== user.id && profile?.role !== 'super_admin') {
      return { success: false, error: 'You can only update your own claims' }
    }

    // Build update object
    const updateRow: Record<string, any> = {}
    if (input.status !== undefined) updateRow.status = input.status
    if (input.resolution !== undefined) updateRow.resolution = input.resolution
    if (input.approvedAmount !== undefined) updateRow.approved_amount = input.approvedAmount
    if (input.resolvedAt !== undefined) updateRow.resolved_at = input.resolvedAt
    if (input.evidence !== undefined) updateRow.evidence = input.evidence

    const { data, error } = await supabase
      .from('claims')
      .update(updateRow)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/dashboard/claims')
    revalidatePath('/admin/claims')
    revalidatePath(`/dashboard/claims/${id}`)

    return {
      success: true,
      data: transformClaimRow(data),
    }
  } catch (error) {
    console.error('Update claim error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update claim',
    }
  }
}

/**
 * Approve a claim
 */
export async function approveClaimAction(
  input: ApproveClaimInput
): Promise<{ success: boolean; data?: Claim; error?: string }> {
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
      return { success: false, error: 'Only admins can approve claims' }
    }

    const { data, error } = await supabase
      .from('claims')
      .update({
        status: 'approved',
        approved_amount: input.approvedAmount,
        resolution: input.resolution || 'Claim approved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', input.claimId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/dashboard/claims')
    revalidatePath('/admin/claims')
    revalidatePath(`/dashboard/claims/${input.claimId}`)

    return {
      success: true,
      data: transformClaimRow(data),
    }
  } catch (error) {
    console.error('Approve claim error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve claim',
    }
  }
}

/**
 * Reject a claim
 */
export async function rejectClaimAction(
  input: RejectClaimInput
): Promise<{ success: boolean; data?: Claim; error?: string }> {
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
      return { success: false, error: 'Only admins can reject claims' }
    }

    const { data, error } = await supabase
      .from('claims')
      .update({
        status: 'rejected',
        resolution: input.resolution,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', input.claimId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/dashboard/claims')
    revalidatePath('/admin/claims')
    revalidatePath(`/dashboard/claims/${input.claimId}`)

    return {
      success: true,
      data: transformClaimRow(data),
    }
  } catch (error) {
    console.error('Reject claim error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject claim',
    }
  }
}

/**
 * Mark claim as paid
 */
export async function markClaimAsPaidAction(
  id: string
): Promise<{ success: boolean; data?: Claim; error?: string }> {
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
      return { success: false, error: 'Only admins can mark claims as paid' }
    }

    const { data, error } = await supabase
      .from('claims')
      .update({
        status: 'paid',
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/dashboard/claims')
    revalidatePath('/admin/claims')
    revalidatePath(`/dashboard/claims/${id}`)

    return {
      success: true,
      data: transformClaimRow(data),
    }
  } catch (error) {
    console.error('Mark claim as paid error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark claim as paid',
    }
  }
}

/**
 * Delete a claim
 */
export async function deleteClaimAction(
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
      return { success: false, error: 'Only admins can delete claims' }
    }

    const { error } = await supabase.from('claims').delete().eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/dashboard/claims')
    revalidatePath('/admin/claims')

    return { success: true }
  } catch (error) {
    console.error('Delete claim error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete claim',
    }
  }
}

/**
 * Transform database row to Claim type
 */
function transformClaimRow(row: any): Claim {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    incidentId: row.incident_id ?? undefined,
    bookingId: row.booking_id,
    type: row.type,
    description: row.description,
    amount: parseFloat(row.amount),
    status: row.status,
    evidence: row.evidence ?? undefined,
    resolution: row.resolution ?? undefined,
    approvedAmount: row.approved_amount ? parseFloat(row.approved_amount) : undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  }
}

