import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Estimate, EstimateStatus, InvoiceItem } from '@/types'

export interface GetEstimatesFilters {
  customerId?: string
  serviceOrderId?: string
  status?: EstimateStatus
  isRecurring?: boolean
  limit?: number
  offset?: number
}

function transformEstimateRow(row: Record<string, unknown>): Estimate {
  return {
    id: row.id as string,
    estimateNumber: row.estimate_number as string,
    serviceOrderId: (row.service_order_id as string) || undefined,
    bookingId: (row.booking_id as string) || undefined,
    customerId: row.customer_id as string,
    customerName: row.customer_name as string,
    customerEmail: (row.customer_email as string) || undefined,
    status: (row.estimate_status as EstimateStatus) || 'draft',
    items: (row.items as InvoiceItem[]) || [],
    subtotal: parseFloat(String(row.subtotal ?? 0)),
    tax: parseFloat(String(row.tax ?? 0)),
    total: parseFloat(String(row.total ?? 0)),
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
    validUntil: row.valid_until ? String(row.valid_until).slice(0, 10) : undefined,
    isRecurring: Boolean(row.is_recurring),
    recurringInterval: (row.recurring_interval as 'monthly' | 'quarterly') || undefined,
    estimateDate: String(row.estimate_date ?? row.created_at).slice(0, 10),
    notes: (row.notes as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function getEstimates(filters?: GetEstimatesFilters): Promise<Estimate[]> {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from('estimates')
    .select('*')
    .eq('status', true)
    .order('created_at', { ascending: false })

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }
  if (filters?.serviceOrderId) {
    query = query.eq('service_order_id', filters.serviceOrderId)
  }
  if (filters?.status) {
    query = query.eq('estimate_status', filters.status)
  }
  if (filters?.isRecurring !== undefined) {
    query = query.eq('is_recurring', filters.isRecurring)
  }
  if (filters?.limit) {
    query = query.range(filters.offset ?? 0, (filters.offset ?? 0) + filters.limit - 1)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch estimates: ${error.message}`)
  return (data || []).map(transformEstimateRow)
}

export async function getEstimateById(id: string): Promise<Estimate | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .eq('status', true)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to fetch estimate: ${error.message}`)
  }
  return data ? transformEstimateRow(data) : null
}

export interface CreateEstimateInput {
  serviceOrderId?: string
  bookingId?: string
  customerId: string
  customerName: string
  customerEmail?: string
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  dueDate?: string
  validUntil?: string
  isRecurring?: boolean
  recurringInterval?: 'monthly' | 'quarterly'
  estimateDate?: string
  notes?: string
}

export async function createEstimate(input: CreateEstimateInput): Promise<Estimate> {
  const supabase = createServerSupabaseClient()
  const row = {
    service_order_id: input.serviceOrderId ?? null,
    booking_id: input.bookingId ?? null,
    customer_id: input.customerId,
    customer_name: input.customerName,
    customer_email: input.customerEmail ?? null,
    estimate_status: 'draft',
    items: input.items,
    subtotal: input.subtotal,
    tax: input.tax,
    total: input.total,
    due_date: input.dueDate ?? null,
    valid_until: input.validUntil ?? null,
    is_recurring: input.isRecurring ?? false,
    recurring_interval: input.recurringInterval ?? null,
    estimate_date: input.estimateDate ?? new Date().toISOString().slice(0, 10),
    notes: input.notes ?? null,
  }
  const { data, error } = await supabase.from('estimates').insert(row).select().single()
  if (error) throw new Error(`Failed to create estimate: ${error.message}`)
  return transformEstimateRow(data)
}

export async function updateEstimate(
  id: string,
  updates: Partial<Pick<Estimate, 'status' | 'items' | 'subtotal' | 'tax' | 'total' | 'dueDate' | 'validUntil' | 'notes'>>
): Promise<Estimate> {
  const supabase = createServerSupabaseClient()
  const updateRow: Record<string, unknown> = {}
  if (updates.status !== undefined) updateRow.estimate_status = updates.status
  if (updates.items !== undefined) updateRow.items = updates.items
  if (updates.subtotal !== undefined) updateRow.subtotal = updates.subtotal
  if (updates.tax !== undefined) updateRow.tax = updates.tax
  if (updates.total !== undefined) updateRow.total = updates.total
  if (updates.dueDate !== undefined) updateRow.due_date = updates.dueDate
  if (updates.validUntil !== undefined) updateRow.valid_until = updates.validUntil
  if (updates.notes !== undefined) updateRow.notes = updates.notes
  const { data, error } = await supabase
    .from('estimates')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`Failed to update estimate: ${error.message}`)
  return transformEstimateRow(data)
}
