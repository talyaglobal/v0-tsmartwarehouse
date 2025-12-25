import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Invoice, InvoiceStatus } from '@/types'
import type { InvoiceFilters } from '../types'

/**
 * Get invoices with optional filters
 * Cached for request deduplication
 */
export const getInvoicesQuery = cache(async (filters?: InvoiceFilters): Promise<Invoice[]> => {
  const supabase = await createServerSupabaseClient()
  
  const {
    customerId,
    companyId,
    status,
    bookingId,
    limit,
    offset = 0,
  } = filters || {}

  let query = supabase
    .from('invoices')
    .select('id, booking_id, customer_id, customer_name, status, items, subtotal, tax, total, due_date, paid_date, created_at')

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }
  
  if (companyId) {
    // Filter by company: get all customer_ids from profiles that belong to this company
    const { data: companyProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
    
    if (companyProfiles && companyProfiles.length > 0) {
      const companyUserIds = companyProfiles.map(p => p.id)
      query = query.in('customer_id', companyUserIds)
    } else {
      // No users in company, return empty result
      query = query.eq('customer_id', '00000000-0000-0000-0000-000000000000')
    }
  }
  
  if (status) {
    query = query.eq('status', status)
  }
  if (bookingId) {
    query = query.eq('booking_id', bookingId)
  }

  // Add pagination if limit is provided
  if (limit) {
    query = query.range(offset, offset + limit - 1)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch invoices: ${error.message}`)
  }

  return (data || []).map(transformInvoiceRow)
})

/**
 * Get single invoice by ID
 * Cached for request deduplication
 */
export const getInvoiceByIdQuery = cache(async (id: string): Promise<Invoice | null> => {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('invoices')
    .select('id, booking_id, customer_id, customer_name, status, items, subtotal, tax, total, due_date, paid_date, created_at')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch invoice: ${error.message}`)
  }

  return data ? transformInvoiceRow(data) : null
})

/**
 * Get invoices for current user
 */
export const getMyInvoicesQuery = cache(async (): Promise<Invoice[]> => {
  const supabase = await createServerSupabaseClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('invoices')
    .select('id, booking_id, customer_id, customer_name, status, items, subtotal, tax, total, due_date, paid_date, created_at')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch my invoices: ${error.message}`)
  }

  return (data || []).map(transformInvoiceRow)
})

/**
 * Get invoice statistics
 */
export const getInvoiceStatsQuery = cache(async (filters?: InvoiceFilters) => {
  const supabase = await createServerSupabaseClient()
  
  let query = supabase.from('invoices').select('status, total')

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
    throw new Error(`Failed to fetch invoice stats: ${error.message}`)
  }

  const stats = {
    total: data?.length || 0,
    draft: 0,
    pending: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
  }

  const now = new Date()

  data?.forEach((invoice) => {
    const total = parseFloat(invoice.total)
    stats.totalAmount += total

    // Count by status
    if (invoice.status === 'draft') stats.draft++
    else if (invoice.status === 'pending') {
      stats.pending++
      stats.pendingAmount += total
    } else if (invoice.status === 'paid') {
      stats.paid++
      stats.paidAmount += total
    } else if (invoice.status === 'overdue') {
      stats.overdue++
      stats.pendingAmount += total
    } else if (invoice.status === 'cancelled') stats.cancelled++
  })

  return stats
})

/**
 * Transform database row to Invoice type
 */
function transformInvoiceRow(row: any): Invoice {
  return {
    id: row.id,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    status: row.status as InvoiceStatus,
    items: row.items,
    subtotal: parseFloat(row.subtotal),
    tax: parseFloat(row.tax),
    total: parseFloat(row.total),
    dueDate: row.due_date,
    paidDate: row.paid_date ?? undefined,
    createdAt: row.created_at,
  }
}

