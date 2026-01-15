'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { invalidateCache, CACHE_PREFIXES } from '@/lib/cache/redis'
import type { Invoice } from '@/types'
import type { CreateInvoiceInput, UpdateInvoiceInput, MarkInvoiceAsPaidInput } from './types'

/**
 * Create a new invoice
 */
export async function createInvoiceAction(
  input: CreateInvoiceInput
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
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
      return { success: false, error: 'Only admins can create invoices' }
    }

    // Create invoice
    const invoiceRow = {
      booking_id: input.bookingId,
      customer_id: input.customerId,
      customer_name: input.customerName,
      status: 'pending',
      items: input.items,
      subtotal: input.subtotal,
      tax: input.tax,
      total: input.total,
      due_date: input.dueDate,
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert(invoiceRow)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Invalidate cache
    await invalidateCache(CACHE_PREFIXES.INVOICES)

    // Revalidate relevant paths
    revalidatePath('/admin/invoices')
    revalidatePath('/dashboard/invoices')
    revalidatePath(`/dashboard/bookings/${input.bookingId}`)

    return {
      success: true,
      data: transformInvoiceRow(data),
    }
  } catch (error) {
    console.error('Create invoice error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invoice',
    }
  }
}

/**
 * Update an existing invoice
 */
export async function updateInvoiceAction(
  id: string,
  input: UpdateInvoiceInput
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
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
      return { success: false, error: 'Only admins can update invoices' }
    }

    // Build update object
    const updateRow: Record<string, any> = {}
    if (input.status !== undefined) updateRow.status = input.status
    if (input.paidDate !== undefined) updateRow.paid_date = input.paidDate

    const { data, error } = await supabase
      .from('invoices')
      .update(updateRow)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Invalidate cache
    await invalidateCache(CACHE_PREFIXES.INVOICES, id)

    // Revalidate relevant paths
    revalidatePath('/admin/invoices')
    revalidatePath('/dashboard/invoices')
    revalidatePath(`/dashboard/invoices/${id}`)

    return {
      success: true,
      data: transformInvoiceRow(data),
    }
  } catch (error) {
    console.error('Update invoice error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update invoice',
    }
  }
}

/**
 * Mark invoice as paid
 */
export async function markInvoiceAsPaidAction(
  input: MarkInvoiceAsPaidInput
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
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
      return { success: false, error: 'Only admins can mark invoices as paid' }
    }

    const paidDate = input.paidDate || new Date().toISOString()

    const { data, error } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_date: paidDate,
      })
      .eq('id', input.invoiceId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Invalidate cache
    await invalidateCache(CACHE_PREFIXES.INVOICES, input.invoiceId)

    // Revalidate relevant paths
    revalidatePath('/admin/invoices')
    revalidatePath('/dashboard/invoices')
    revalidatePath(`/dashboard/invoices/${input.invoiceId}`)

    return {
      success: true,
      data: transformInvoiceRow(data),
    }
  } catch (error) {
    console.error('Mark invoice as paid error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark invoice as paid',
    }
  }
}

/**
 * Cancel an invoice
 */
export async function cancelInvoiceAction(
  id: string
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
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
      return { success: false, error: 'Only admins can cancel invoices' }
    }

    const { data, error } = await supabase
      .from('invoices')
      .update({
        status: 'cancelled',
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Invalidate cache
    await invalidateCache(CACHE_PREFIXES.INVOICES, id)

    // Revalidate relevant paths
    revalidatePath('/admin/invoices')
    revalidatePath('/dashboard/invoices')
    revalidatePath(`/dashboard/invoices/${id}`)

    return {
      success: true,
      data: transformInvoiceRow(data),
    }
  } catch (error) {
    console.error('Cancel invoice error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel invoice',
    }
  }
}

/**
 * Generate invoice for a booking
 */
export async function generateInvoiceForBookingAction(
  bookingId: string
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
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
      return { success: false, error: 'Only admins can generate invoices' }
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return { success: false, error: 'Booking not found' }
    }

    // Check if invoice already exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('booking_id', bookingId)
      .single()

    if (existingInvoice) {
      return { success: false, error: 'Invoice already exists for this booking' }
    }

    // Calculate invoice items and totals
    const items = []
    let subtotal = 0

    if (booking.type === 'pallet') {
      const unitPrice = 17.5 // $17.50 per pallet per month
      const quantity = booking.pallet_count || 0
      const total = unitPrice * quantity
      items.push({
        description: `Pallet Storage (${quantity} units)`,
        quantity,
        unitPrice,
        total,
      })
      subtotal = total
    } else if (booking.type === 'area-rental') {
      const unitPrice = 0.5 // $0.50 per sq ft per month
      const quantity = booking.area_sq_ft || 0
      const total = unitPrice * quantity
      items.push({
        description: `Space Storage (${quantity} sq ft)`,
        quantity,
        unitPrice,
        total,
      })
      subtotal = total
    }

    const tax = subtotal * 0.1 // 10% tax
    const total = subtotal + tax

    // Calculate due date (30 days from now)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    // Create invoice
    const invoiceRow = {
      booking_id: bookingId,
      customer_id: booking.customer_id,
      customer_name: booking.customer_name,
      status: 'pending',
      items,
      subtotal,
      tax,
      total,
      due_date: dueDate.toISOString().split('T')[0],
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert(invoiceRow)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Invalidate cache
    await invalidateCache(CACHE_PREFIXES.INVOICES)

    // Revalidate relevant paths
    revalidatePath('/admin/invoices')
    revalidatePath('/dashboard/invoices')
    revalidatePath(`/dashboard/bookings/${bookingId}`)

    return {
      success: true,
      data: transformInvoiceRow(data),
    }
  } catch (error) {
    console.error('Generate invoice error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate invoice',
    }
  }
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
    status: row.status,
    items: row.items,
    subtotal: parseFloat(row.subtotal),
    tax: parseFloat(row.tax),
    total: parseFloat(row.total),
    dueDate: row.due_date,
    paidDate: row.paid_date ?? undefined,
    createdAt: row.created_at,
  }
}


