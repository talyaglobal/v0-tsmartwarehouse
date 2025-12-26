'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  fetchServiceOrders,
  fetchServiceOrderById,
  createNewServiceOrder,
  updateExistingServiceOrder,
  cancelExistingServiceOrder,
} from './lib/queries'
import { calculateOrderTotal } from '@/lib/business-logic/orders'
import type { CreateServiceOrderInput, UpdateServiceOrderInput } from './types'

/**
 * Get all service orders for the current user
 */
export async function getServiceOrders(filters?: {
  status?: string
  bookingId?: string
}) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const orders = await fetchServiceOrders({
      customerId: user.id,
      status: filters?.status as any,
      bookingId: filters?.bookingId,
    })

    return { success: true, data: orders }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get a single service order by ID
 */
export async function getServiceOrderById(id: string) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const order = await fetchServiceOrderById(id)

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    // Verify user owns this order
    if (order.customerId !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    return { success: true, data: order }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create a new service order
 */
export async function createServiceOrder(input: CreateServiceOrderInput) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get user profile for customer name
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Calculate total amount from items
    const totalAmount = calculateOrderTotal(
      input.items.map(item => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    )

    const order = await createNewServiceOrder(
      {
        customerId: user.id,
        customerName: profile.name || profile.email?.split('@')[0] || 'Customer',
        bookingId: input.bookingId,
        status: input.status || 'draft',
        priority: input.priority || 'normal',
        requestedDate: input.requestedDate,
        dueDate: input.dueDate,
        notes: input.notes,
        totalAmount,
      },
      input.items.map(item => ({
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        notes: item.notes,
        status: 'pending' as const,
      }))
    )

    revalidatePath('/dashboard/orders')
    return { success: true, data: order }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update a service order
 */
export async function updateServiceOrder(id: string, input: UpdateServiceOrderInput) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify user owns this order
    const existingOrder = await fetchServiceOrderById(id)
    if (!existingOrder) {
      return { success: false, error: 'Order not found' }
    }

    if (existingOrder.customerId !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Only allow updates to draft/pending orders
    if (!['draft', 'pending'].includes(existingOrder.status)) {
      return { success: false, error: 'Cannot update order in current status' }
    }

    const order = await updateExistingServiceOrder(id, input)

    revalidatePath('/dashboard/orders')
    revalidatePath(`/dashboard/orders/${id}`)
    return { success: true, data: order }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Cancel a service order
 */
export async function cancelServiceOrder(id: string) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify user owns this order
    const existingOrder = await fetchServiceOrderById(id)
    if (!existingOrder) {
      return { success: false, error: 'Order not found' }
    }

    if (existingOrder.customerId !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const order = await cancelExistingServiceOrder(id)

    revalidatePath('/dashboard/orders')
    revalidatePath(`/dashboard/orders/${id}`)
    return { success: true, data: order }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

