import type { Invoice, InvoiceStatus } from '@/types'

export type { Invoice, InvoiceStatus }

export interface InvoiceFilters {
  customerId?: string
  companyId?: string
  status?: InvoiceStatus
  bookingId?: string
  limit?: number
  offset?: number
}

export interface CreateInvoiceInput {
  bookingId: string
  customerId: string
  customerName: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  tax: number
  total: number
  dueDate: string
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus
  paidDate?: string
}

export interface MarkInvoiceAsPaidInput {
  invoiceId: string
  paidDate?: string
}

