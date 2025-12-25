import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Claim, ClaimStatus } from '@/types'
import type { ClaimFilters } from '../types'

/**
 * Get claims with optional filters
 * Cached for request deduplication
 */
export const getClaimsQuery = cache(async (filters?: ClaimFilters): Promise<Claim[]> => {
  const supabase = await createServerSupabaseClient()
  
  let query = supabase.from('claims').select('*')

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }
  
  if (filters?.companyId) {
    // Filter by company: get all customer_ids from profiles that belong to this company
    const { data: companyProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', filters.companyId)
    
    if (companyProfiles && companyProfiles.length > 0) {
      const companyUserIds = companyProfiles.map(p => p.id)
      query = query.in('customer_id', companyUserIds)
    } else {
      // No users in company, return empty result
      query = query.eq('customer_id', '00000000-0000-0000-0000-000000000000')
    }
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
})

/**
 * Get single claim by ID
 * Cached for request deduplication
 */
export const getClaimByIdQuery = cache(async (id: string): Promise<Claim | null> => {
  const supabase = await createServerSupabaseClient()
  
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
})

/**
 * Get claims for current user
 */
export const getMyClaimsQuery = cache(async (): Promise<Claim[]> => {
  const supabase = await createServerSupabaseClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch my claims: ${error.message}`)
  }

  return (data || []).map(transformClaimRow)
})

/**
 * Get claim statistics
 */
export const getClaimStatsQuery = cache(async (filters?: ClaimFilters) => {
  const supabase = await createServerSupabaseClient()
  
  let query = supabase.from('claims').select('status, amount, approved_amount')

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }
  if (filters?.companyId) {
    const { data: companyProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', filters.companyId)
    
    if (companyProfiles && companyProfiles.length > 0) {
      const companyUserIds = companyProfiles.map(p => p.id)
      query = query.in('customer_id', companyUserIds)
    }
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch claim stats: ${error.message}`)
  }

  const stats = {
    total: data?.length || 0,
    submitted: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    paid: 0,
    totalAmount: 0,
    approvedAmount: 0,
  }

  data?.forEach((claim) => {
    const amount = parseFloat(claim.amount)
    stats.totalAmount += amount

    // Count by status
    if (claim.status === 'submitted') stats.submitted++
    else if (claim.status === 'under-review') stats.underReview++
    else if (claim.status === 'approved') {
      stats.approved++
      if (claim.approved_amount) {
        stats.approvedAmount += parseFloat(claim.approved_amount)
      }
    } else if (claim.status === 'rejected') stats.rejected++
    else if (claim.status === 'paid') {
      stats.paid++
      if (claim.approved_amount) {
        stats.approvedAmount += parseFloat(claim.approved_amount)
      }
    }
  })

  return stats
})

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

