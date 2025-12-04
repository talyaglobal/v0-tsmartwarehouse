import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Invoice, InvoiceStatus } from '@/types'

/**
 * Database operations for Invoices
 */

export async function getInvoices(filters?: {
  customerId?: string
  status?: InvoiceStatus
  bookingId?: string
}) {
  const supabase = createServerSupabaseClient()
  let query = supabase.from('invoices').select('*')

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.bookingId) {
    query = query.eq('booking_id', filters.bookingId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch invoices: ${error.message}`)
  }

  return (data || []).map(transformInvoiceRow)
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch invoice: ${error.message}`)
  }

  return data ? transformInvoiceRow(data) : null
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

  return transformInvoiceRow(data)
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

  return transformInvoiceRow(data)
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

