/**
 * Pallet checkout requests: remaining payment before check-out
 */

import { createServerSupabaseClient } from "@/lib/supabase/server"

export interface PalletCheckoutRequest {
  id: string
  bookingId: string
  warehouseId: string
  customerId: string
  palletCount: number
  amount: number
  status: "pending_payment" | "paid" | "completed"
  paidAt: string | null
  createdAt: string
  createdBy: string | null
  metadata: Record<string, unknown>
}

export async function createCheckoutRequest(params: {
  bookingId: string
  warehouseId: string
  customerId: string
  palletCount: number
  amount: number
  createdBy: string
  metadata?: Record<string, unknown>
}): Promise<PalletCheckoutRequest> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("pallet_checkout_requests")
    .insert({
      booking_id: params.bookingId,
      warehouse_id: params.warehouseId,
      customer_id: params.customerId,
      pallet_count: params.palletCount,
      amount: params.amount,
      status: "pending_payment",
      created_by: params.createdBy,
      metadata: params.metadata ?? {},
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create checkout request: ${error.message}`)
  return transformRow(data)
}

export async function getCheckoutRequestsByBookingId(bookingId: string): Promise<PalletCheckoutRequest[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("pallet_checkout_requests")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`Failed to fetch checkout requests: ${error.message}`)
  return (data || []).map(transformRow)
}

export async function getCheckoutRequestsForWarehouse(options: {
  warehouseId: string
  status?: "pending_payment" | "paid" | "completed"
}): Promise<PalletCheckoutRequest[]> {
  const supabase = createServerSupabaseClient()
  let q = supabase
    .from("pallet_checkout_requests")
    .select("*")
    .eq("warehouse_id", options.warehouseId)
    .order("created_at", { ascending: false })
  if (options.status) {
    q = q.eq("status", options.status)
  }
  const { data, error } = await q
  if (error) throw new Error(`Failed to fetch checkout requests: ${error.message}`)
  return (data || []).map(transformRow)
}

export async function getCheckoutRequestById(id: string): Promise<PalletCheckoutRequest | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("pallet_checkout_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch checkout request: ${error.message}`)
  return data ? transformRow(data) : null
}

export async function markCheckoutRequestPaid(id: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from("pallet_checkout_requests")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id)

  if (error) throw new Error(`Failed to update checkout request: ${error.message}`)
}

export async function markCheckoutRequestCompleted(id: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from("pallet_checkout_requests")
    .update({ status: "completed" })
    .eq("id", id)

  if (error) throw new Error(`Failed to update checkout request: ${error.message}`)
}

function transformRow(row: any): PalletCheckoutRequest {
  return {
    id: row.id,
    bookingId: row.booking_id,
    warehouseId: row.warehouse_id,
    customerId: row.customer_id,
    palletCount: row.pallet_count,
    amount: parseFloat(row.amount),
    status: row.status,
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    metadata: row.metadata ?? {},
  }
}
