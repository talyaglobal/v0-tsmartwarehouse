import type { Invoice, InvoiceLineItem, CreateInvoiceRequest, Payment, RecordPaymentRequest } from "../types"
import type { PaginatedResponse, PaginationParams, PaymentStatus } from "../../common/types"

const invoices: Invoice[] = [
  {
    id: "inv-001",
    invoice_number: "INV-2024-0001",
    booking_id: "book-001",
    customer_id: "cust-001",
    subtotal: 4000,
    tax_amount: 320,
    discount_amount: 120,
    total_amount: 4200,
    paid_amount: 4200,
    due_date: "2024-02-15T00:00:00Z",
    status: "paid",
    line_items: [
      { id: "li-001", description: "Monthly Storage - Unit A-101", quantity: 12, unit_price: 350, total: 4200 },
    ],
    created_at: "2024-01-15T00:00:00Z",
    paid_at: "2024-01-20T14:30:00Z",
  },
  {
    id: "inv-002",
    invoice_number: "INV-2024-0002",
    booking_id: "book-002",
    customer_id: "cust-002",
    subtotal: 8000,
    tax_amount: 640,
    discount_amount: 140,
    total_amount: 8500,
    paid_amount: 1700,
    due_date: "2024-07-15T00:00:00Z",
    status: "partial",
    line_items: [
      { id: "li-002", description: "Fulfillment Services - Setup", quantity: 1, unit_price: 2000, total: 2000 },
      { id: "li-003", description: "Pick & Pack (per item)", quantity: 500, unit_price: 12, total: 6000 },
    ],
    created_at: "2024-06-01T10:00:00Z",
  },
]

const payments: Payment[] = []

export class InvoiceService {
  private static instance: InvoiceService
  private taxRate = 0.08

  static getInstance(): InvoiceService {
    if (!InvoiceService.instance) {
      InvoiceService.instance = new InvoiceService()
    }
    return InvoiceService.instance
  }

  async getInvoices(
    filters?: { status?: PaymentStatus[]; customer_id?: string },
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<Invoice>> {
    let filtered = [...invoices]

    if (filters?.status?.length) {
      filtered = filtered.filter((i) => filters.status!.includes(i.status))
    }
    if (filters?.customer_id) {
      filtered = filtered.filter((i) => i.customer_id === filters.customer_id)
    }

    const page = pagination?.page ?? 1
    const limit = pagination?.limit ?? 10
    const start = (page - 1) * limit
    const end = start + limit

    return {
      data: filtered.slice(start, end),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    }
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    return invoices.find((i) => i.id === id) ?? null
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    return invoices.find((i) => i.invoice_number === invoiceNumber) ?? null
  }

  async createInvoice(data: CreateInvoiceRequest): Promise<Invoice> {
    const lineItems: InvoiceLineItem[] = data.line_items.map((item, index) => ({
      ...item,
      id: `li-${Date.now()}-${index}`,
    }))

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
    const discountAmount = data.discount_amount ?? 0
    const taxAmount = (subtotal - discountAmount) * this.taxRate
    const totalAmount = subtotal - discountAmount + taxAmount

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoice_number: `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`,
      booking_id: data.booking_id,
      customer_id: data.customer_id,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      paid_amount: 0,
      due_date: data.due_date,
      status: "pending",
      line_items: lineItems,
      notes: data.notes,
      created_at: new Date().toISOString(),
    }

    invoices.push(invoice)
    return invoice
  }

  async recordPayment(data: RecordPaymentRequest): Promise<Payment> {
    const invoice = await this.getInvoiceById(data.invoice_id)
    if (!invoice) {
      throw new Error("Invoice not found")
    }

    const payment: Payment = {
      id: `pay-${Date.now()}`,
      invoice_id: data.invoice_id,
      amount: data.amount,
      payment_method: data.payment_method,
      transaction_id: data.transaction_id,
      status: "completed",
      processed_at: new Date().toISOString(),
      notes: data.notes,
    }

    payments.push(payment)

    // Update invoice
    invoice.paid_amount += data.amount
    if (invoice.paid_amount >= invoice.total_amount) {
      invoice.status = "paid"
      invoice.paid_at = new Date().toISOString()
    } else if (invoice.paid_amount > 0) {
      invoice.status = "partial"
    }

    return payment
  }

  async getInvoicePayments(invoiceId: string): Promise<Payment[]> {
    return payments.filter((p) => p.invoice_id === invoiceId)
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    const now = new Date()
    return invoices.filter((i) => {
      if (i.status === "paid") return false
      return new Date(i.due_date) < now
    })
  }

  async getRevenueSummary(
    startDate: string,
    endDate: string,
  ): Promise<{
    total_invoiced: number
    total_collected: number
    outstanding: number
    overdue: number
  }> {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const now = new Date()

    const periodInvoices = invoices.filter((i) => {
      const created = new Date(i.created_at)
      return created >= start && created <= end
    })

    return {
      total_invoiced: periodInvoices.reduce((sum, i) => sum + i.total_amount, 0),
      total_collected: periodInvoices.reduce((sum, i) => sum + i.paid_amount, 0),
      outstanding: periodInvoices
        .filter((i) => i.status !== "paid")
        .reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0),
      overdue: periodInvoices
        .filter((i) => i.status !== "paid" && new Date(i.due_date) < now)
        .reduce((sum, i) => sum + (i.total_amount - i.paid_amount), 0),
    }
  }
}

export const invoiceService = InvoiceService.getInstance()
