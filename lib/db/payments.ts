import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Payment, PaymentTransaction, Refund, PaymentStatus, RefundStatus } from "@/types"

/**
 * Database operations for Payments
 */

export async function getPayments(filters?: {
  customerId?: string
  invoiceId?: string
  status?: PaymentStatus
}) {
  const supabase = createServerSupabaseClient()
  let query = supabase.from("payments").select("*")

  if (filters?.customerId) {
    query = query.eq("customer_id", filters.customerId)
  }
  if (filters?.invoiceId) {
    query = query.eq("invoice_id", filters.invoiceId)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch payments: ${error.message}`)
  }

  return (data || []).map(transformPaymentRow)
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null
    }
    throw new Error(`Failed to fetch payment: ${error.message}`)
  }

  return data ? transformPaymentRow(data) : null
}

export async function createPayment(
  payment: Omit<Payment, "id" | "createdAt" | "updatedAt">
): Promise<Payment> {
  const supabase = createServerSupabaseClient()

  const paymentRow = {
    invoice_id: payment.invoiceId,
    customer_id: payment.customerId,
    amount: payment.amount,
    currency: payment.currency || "USD",
    status: payment.status,
    payment_method: payment.paymentMethod,
    stripe_payment_intent_id: payment.stripePaymentIntentId ?? null,
    stripe_charge_id: payment.stripeChargeId ?? null,
    credit_balance_used: payment.creditBalanceUsed ?? 0,
    metadata: payment.metadata ?? null,
    completed_at: payment.completedAt ?? null,
  }

  const { data, error } = await supabase
    .from("payments")
    .insert(paymentRow)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create payment: ${error.message}`)
  }

  return transformPaymentRow(data)
}

export async function updatePayment(
  id: string,
  updates: Partial<Omit<Payment, "id" | "createdAt">>
): Promise<Payment> {
  const supabase = createServerSupabaseClient()

  const updateRow: Record<string, any> = {}
  if (updates.status !== undefined) updateRow.status = updates.status
  if (updates.stripePaymentIntentId !== undefined)
    updateRow.stripe_payment_intent_id = updates.stripePaymentIntentId
  if (updates.stripeChargeId !== undefined) updateRow.stripe_charge_id = updates.stripeChargeId
  if (updates.completedAt !== undefined) updateRow.completed_at = updates.completedAt
  if (updates.metadata !== undefined) updateRow.metadata = updates.metadata

  const { data, error } = await supabase
    .from("payments")
    .update(updateRow)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update payment: ${error.message}`)
  }

  return transformPaymentRow(data)
}

/**
 * Payment Transactions
 */
export async function getPaymentTransactions(filters?: {
  paymentId?: string
  type?: "payment" | "refund" | "credit_adjustment"
}) {
  const supabase = createServerSupabaseClient()
  let query = supabase.from("payment_transactions").select("*")

  if (filters?.paymentId) {
    query = query.eq("payment_id", filters.paymentId)
  }
  if (filters?.type) {
    query = query.eq("type", filters.type)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch payment transactions: ${error.message}`)
  }

  return (data || []).map(transformTransactionRow)
}

export async function createPaymentTransaction(
  transaction: Omit<PaymentTransaction, "id" | "createdAt">
): Promise<PaymentTransaction> {
  const supabase = createServerSupabaseClient()

  const transactionRow = {
    payment_id: transaction.paymentId,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency || "USD",
    status: transaction.status,
    description: transaction.description,
    metadata: transaction.metadata ?? null,
  }

  const { data, error } = await supabase
    .from("payment_transactions")
    .insert(transactionRow)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create payment transaction: ${error.message}`)
  }

  return transformTransactionRow(data)
}

/**
 * Refunds
 */
export async function getRefunds(filters?: {
  customerId?: string
  paymentId?: string
  invoiceId?: string
  status?: RefundStatus
}) {
  const supabase = createServerSupabaseClient()
  let query = supabase.from("refunds").select("*")

  if (filters?.customerId) {
    query = query.eq("customer_id", filters.customerId)
  }
  if (filters?.paymentId) {
    query = query.eq("payment_id", filters.paymentId)
  }
  if (filters?.invoiceId) {
    query = query.eq("invoice_id", filters.invoiceId)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch refunds: ${error.message}`)
  }

  return (data || []).map(transformRefundRow)
}

export async function getRefundById(id: string): Promise<Refund | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("refunds")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null
    }
    throw new Error(`Failed to fetch refund: ${error.message}`)
  }

  return data ? transformRefundRow(data) : null
}

export async function createRefund(refund: Omit<Refund, "id" | "createdAt">): Promise<Refund> {
  const supabase = createServerSupabaseClient()

  const refundRow = {
    payment_id: refund.paymentId,
    invoice_id: refund.invoiceId,
    customer_id: refund.customerId,
    amount: refund.amount,
    currency: refund.currency || "USD",
    reason: refund.reason ?? null,
    status: refund.status,
    stripe_refund_id: refund.stripeRefundId ?? null,
    metadata: refund.metadata ?? null,
    processed_at: refund.processedAt ?? null,
  }

  const { data, error } = await supabase
    .from("refunds")
    .insert(refundRow)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create refund: ${error.message}`)
  }

  return transformRefundRow(data)
}

export async function updateRefund(
  id: string,
  updates: Partial<Omit<Refund, "id" | "createdAt">>
): Promise<Refund> {
  const supabase = createServerSupabaseClient()

  const updateRow: Record<string, any> = {}
  if (updates.status !== undefined) updateRow.status = updates.status
  if (updates.stripeRefundId !== undefined) updateRow.stripe_refund_id = updates.stripeRefundId
  if (updates.processedAt !== undefined) updateRow.processed_at = updates.processedAt
  if (updates.metadata !== undefined) updateRow.metadata = updates.metadata

  const { data, error } = await supabase
    .from("refunds")
    .update(updateRow)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update refund: ${error.message}`)
  }

  return transformRefundRow(data)
}

/**
 * Credit Balance Management
 */
export async function getCustomerCreditBalance(customerId: string): Promise<number> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("users")
    .select("credit_balance")
    .eq("id", customerId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch credit balance: ${error.message}`)
  }

  return parseFloat(data?.credit_balance || "0")
}

export async function updateCustomerCreditBalance(
  customerId: string,
  amount: number
): Promise<number> {
  const supabase = createServerSupabaseClient()

  // Use the database function to update credit balance
  const { data, error } = await supabase.rpc("update_customer_credit_balance", {
    p_customer_id: customerId,
    p_amount: amount,
  })

  if (error) {
    throw new Error(`Failed to update credit balance: ${error.message}`)
  }

  return parseFloat(data || "0")
}

/**
 * Transform database rows to types
 */
function transformPaymentRow(row: any): Payment {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    customerId: row.customer_id,
    amount: parseFloat(row.amount),
    currency: row.currency || "USD",
    status: row.status as PaymentStatus,
    paymentMethod: row.payment_method,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? undefined,
    stripeChargeId: row.stripe_charge_id ?? undefined,
    creditBalanceUsed: row.credit_balance_used ? parseFloat(row.credit_balance_used) : undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  }
}

function transformTransactionRow(row: any): PaymentTransaction {
  return {
    id: row.id,
    paymentId: row.payment_id,
    type: row.type,
    amount: parseFloat(row.amount),
    currency: row.currency || "USD",
    status: row.status as PaymentStatus,
    description: row.description,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  }
}

function transformRefundRow(row: any): Refund {
  return {
    id: row.id,
    paymentId: row.payment_id,
    invoiceId: row.invoice_id,
    customerId: row.customer_id,
    amount: parseFloat(row.amount),
    currency: row.currency || "USD",
    reason: row.reason ?? undefined,
    status: row.status as RefundStatus,
    stripeRefundId: row.stripe_refund_id ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    processedAt: row.processed_at ?? undefined,
  }
}

