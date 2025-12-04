import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Claim, ClaimStatus } from '@/types'

/**
 * Database operations for Claims
 */

export async function getClaims(filters?: {
  customerId?: string
  status?: ClaimStatus
  bookingId?: string
  incidentId?: string
}) {
  const supabase = createServerSupabaseClient()
  let query = supabase.from('claims').select('*')

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.bookingId) {
    query = query.eq('booking_id', filters.bookingId)
  }
  if (filters?.incidentId) {
    query = query.eq('incident_id', filters.incidentId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch claims: ${error.message}`)
  }

  return (data || []).map(transformClaimRow)
}

export async function getClaimById(id: string): Promise<Claim | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch claim: ${error.message}`)
  }

  return data ? transformClaimRow(data) : null
}

export async function createClaim(claim: Omit<Claim, 'id' | 'createdAt'>): Promise<Claim> {
  const supabase = createServerSupabaseClient()
  
  const claimRow = {
    customer_id: claim.customerId,
    customer_name: claim.customerName,
    incident_id: claim.incidentId ?? null,
    booking_id: claim.bookingId,
    type: claim.type,
    description: claim.description,
    amount: claim.amount,
    status: claim.status,
    evidence: claim.evidence ?? null,
    resolution: claim.resolution ?? null,
    approved_amount: claim.approvedAmount ?? null,
    resolved_at: claim.resolvedAt ?? null,
  }

  const { data, error } = await supabase
    .from('claims')
    .insert(claimRow)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create claim: ${error.message}`)
  }

  return transformClaimRow(data)
}

export async function updateClaim(
  id: string,
  updates: Partial<Omit<Claim, 'id' | 'createdAt'>>,
): Promise<Claim> {
  const supabase = createServerSupabaseClient()
  
  const updateRow: Record<string, any> = {}
  if (updates.status !== undefined) updateRow.status = updates.status
  if (updates.resolution !== undefined) updateRow.resolution = updates.resolution
  if (updates.approvedAmount !== undefined) updateRow.approved_amount = updates.approvedAmount
  if (updates.resolvedAt !== undefined) updateRow.resolved_at = updates.resolvedAt
  if (updates.evidence !== undefined) updateRow.evidence = updates.evidence

  const { data, error } = await supabase
    .from('claims')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update claim: ${error.message}`)
  }

  return transformClaimRow(data)
}

export async function deleteClaim(id: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  const { error } = await supabase
    .from('claims')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete claim: ${error.message}`)
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
    status: row.status as ClaimStatus,
    evidence: row.evidence ?? undefined,
    resolution: row.resolution ?? undefined,
    approvedAmount: row.approved_amount ? parseFloat(row.approved_amount) : undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  }
}

