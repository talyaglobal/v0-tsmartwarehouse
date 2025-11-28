import type { PaymentStatus } from "../common/types"

export interface Invoice {
  id: string
  invoice_number: string
  booking_id: string
  customer_id: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  paid_amount: number
  due_date: string
  status: PaymentStatus
  line_items: InvoiceLineItem[]
  notes?: string
  created_at: string
  paid_at?: string
}

export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number
  payment_method: "credit_card" | "bank_transfer" | "cash" | "check"
  transaction_id?: string
  status: "pending" | "completed" | "failed" | "refunded"
  processed_at: string
  notes?: string
}

export interface CreateInvoiceRequest {
  booking_id: string
  customer_id: string
  line_items: Omit<InvoiceLineItem, "id">[]
  due_date: string
  notes?: string
  discount_amount?: number
}

export interface RecordPaymentRequest {
  invoice_id: string
  amount: number
  payment_method: Payment["payment_method"]
  transaction_id?: string
  notes?: string
}

export interface AccountingSyncStatus {
  provider: "quickbooks" | "xero" | "sage"
  last_sync: string
  status: "synced" | "pending" | "error"
  error_message?: string
}
