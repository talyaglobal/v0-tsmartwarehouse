import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Invoice, InvoiceStatus } from '@/types'
import { getCache, setCache, invalidateCache, generateCacheKey, CACHE_PREFIXES, CACHE_TTL } from '@/lib/cache/redis'

/**
 * Database operations for Invoices with caching and query optimization
 */

interface GetInvoicesOptions {
  customerId?: string
  status?: InvoiceStatus
  bookingId?: string
  limit?: number
  offset?: number
  useCache?: boolean
}

export async function getInvoices(filters?: GetInvoicesOptions) {
  const {
    customerId,
    status,
    bookingId,
    limit,
    offset = 0,
    useCache = true,
  } = filters || {}

  // Generate cache key
  const cacheKey = generateCacheKey(
    CACHE_PREFIXES.INVOICES,
    customerId || 'all',
    status || 'all',
    bookingId || 'all',
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
  let query = supabase
    .from('invoices')
    .select('id, booking_id, customer_id, customer_name, status, items, subtotal, tax, total, due_date, paid_date, created_at')

  if (customerId) {
    query = query.eq('customer_id', customerId)
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
    .select('id, booking_id, customer_id, customer_name, status, items, subtotal, tax, total, due_date, paid_date, created_at')
    .eq('id', id)
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
  
  const invoiceRow = {
    booking_id: invoice.bookingId,
    customer_id: invoice.customerId,
    customer_name: invoice.customerName,
    status: invoice.status,
    items: invoice.items,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    due_date: invoice.dueDate,
    paid_date: invoice.paidDate ?? null,
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
  if (updates.status !== undefined) updateRow.status = updates.status
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

