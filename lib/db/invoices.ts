import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Invoice, InvoiceStatus } from '@/types'
import { getCache, setCache, invalidateCache, generateCacheKey, CACHE_PREFIXES, CACHE_TTL } from '@/lib/cache/redis'

/**
 * Database operations for Invoices with caching and query optimization
 */

interface GetInvoicesOptions {
  customerId?: string
  companyId?: string
  status?: InvoiceStatus
  bookingId?: string
  serviceOrderId?: string
  limit?: number
  offset?: number
  useCache?: boolean
}

export async function getInvoices(filters?: GetInvoicesOptions) {
  const {
    customerId,
    companyId,
    status,
    bookingId,
    serviceOrderId,
    limit,
    offset = 0,
    useCache = true,
  } = filters || {}

  // Generate cache key
  const cacheKey = generateCacheKey(
    CACHE_PREFIXES.INVOICES,
    customerId || companyId || 'all',
    status || 'all',
    bookingId || serviceOrderId || 'all',
    limit || 'all',
    offset
  )

  // Try cache first
  if (useCache) {
    const cached = await getCache<Invoice[]>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const supabase = createServerSupabaseClient()
  
  // Optimize: Only select needed fields instead of '*'
  // Note: invoice_status is the business status, status is for soft delete
  let query = supabase
    .from('invoices')
    .select('id, booking_id, service_order_id, estimate_id, customer_id, customer_name, invoice_status, status, items, subtotal, tax, total, due_date, paid_date, created_at')

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
      query = query.eq('customer_id', '00000000-0000-0000-0000-000000000000') // Non-existent ID
    }
  }
  // Add soft delete filter - only non-deleted invoices
  query = query.eq('status', true)
  
  if (status) {
    query = query.eq('invoice_status', status)
  }
  if (bookingId) {
    query = query.eq('booking_id', bookingId)
  }
  if (serviceOrderId) {
    query = query.eq('service_order_id', serviceOrderId)
  }

  // Add pagination if limit is provided
  if (limit) {
    query = query.range(offset, offset + limit - 1)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch invoices: ${error.message}`)
  }

  const invoices = (data || []).map(transformInvoiceRow)

  // Cache the results
  if (useCache) {
    await setCache(cacheKey, invoices, CACHE_TTL.MEDIUM)
  }

  return invoices
}

export async function getInvoiceById(id: string, useCache: boolean = true): Promise<Invoice | null> {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.INVOICE, id)

  // Try cache first
  if (useCache) {
    const cached = await getCache<Invoice>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('id, booking_id, service_order_id, estimate_id, customer_id, customer_name, invoice_status, status, items, subtotal, tax, total, due_date, paid_date, created_at')
    .eq('id', id)
    .eq('status', true) // Soft delete filter
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch invoice: ${error.message}`)
  }

  const invoice = data ? transformInvoiceRow(data) : null

  // Cache the result
  if (invoice && useCache) {
    await setCache(cacheKey, invoice, CACHE_TTL.MEDIUM)
  }

  return invoice
}

export async function createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>): Promise<Invoice> {
  const supabase = createServerSupabaseClient()
  
  const invoiceRow: Record<string, unknown> = {
    booking_id: invoice.bookingId || null,
    service_order_id: invoice.serviceOrderId || null,
    customer_id: invoice.customerId,
    customer_name: invoice.customerName,
    invoice_status: invoice.status, // Business status (draft, pending, paid, etc.)
    status: true, // Soft delete (always true for new invoices)
    items: invoice.items,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    due_date: invoice.dueDate,
    paid_date: invoice.paidDate ?? null,
  }
  if ('estimateId' in invoice && invoice.estimateId) {
    invoiceRow.estimate_id = invoice.estimateId
  }

  const { data, error } = await supabase
    .from('invoices')
    .insert(invoiceRow)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create invoice: ${error.message}`)
  }

  const newInvoice = transformInvoiceRow(data)

  // Invalidate cache
  await invalidateCache(CACHE_PREFIXES.INVOICES)

  return newInvoice
}

export async function updateInvoice(
  id: string,
  updates: Partial<Omit<Invoice, 'id' | 'createdAt'>>,
): Promise<Invoice> {
  const supabase = createServerSupabaseClient()
  
  const updateRow: Record<string, any> = {}
  if (updates.status !== undefined) updateRow.invoice_status = updates.status // Business status
  if (updates.paidDate !== undefined) updateRow.paid_date = updates.paidDate

  const { data, error } = await supabase
    .from('invoices')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update invoice: ${error.message}`)
  }

  const updatedInvoice = transformInvoiceRow(data)

  // Invalidate cache
  await invalidateCache(CACHE_PREFIXES.INVOICES, id)

  return updatedInvoice
}

/**
 * Transform database row to Invoice type
 */
function transformInvoiceRow(row: any): Invoice {
  return {
    id: row.id,
    bookingId: row.booking_id || undefined,
    serviceOrderId: row.service_order_id || undefined,
    estimateId: row.estimate_id || undefined,
    customerId: row.customer_id,
    customerName: row.customer_name,
    status: (row.invoice_status || row.status) as InvoiceStatus, // invoice_status is business status, fallback to status for backward compatibility
    items: row.items,
    subtotal: parseFloat(row.subtotal),
    tax: parseFloat(row.tax),
    total: parseFloat(row.total),
    dueDate: row.due_date,
    paidDate: row.paid_date ?? undefined,
    createdAt: row.created_at,
  }
}

