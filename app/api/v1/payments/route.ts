import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/api-middleware"
import { processInvoicePayment, getPaymentHistory } from "@/lib/business-logic/payments"
import { getPayments } from "@/lib/db/payments"
import type { PaymentsListResponse, PaymentResponse, ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/payments
 * List payments with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      const errorData: ErrorResponse = {
        success: false,
        error: authResult.error || "Unauthorized",
        statusCode: 401,
      }
      return NextResponse.json(errorData, { status: 401 })
    }

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get("invoiceId")
    const status = searchParams.get("status")

    // Customers can only see their own payments
    // Admins can see all payments
    const filters: any = {}
    if (user?.role === "customer") {
      filters.customerId = user.id
    } else if (invoiceId) {
      filters.invoiceId = invoiceId
    }
    if (status) {
      filters.status = status
    }

    const payments = await getPayments(filters)

    const responseData: PaymentsListResponse = {
      success: true,
      data: payments,
      total: payments.length,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error fetching payments:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch payments",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

/**
 * POST /api/v1/payments
 * Create a new payment for an invoice
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      const errorData: ErrorResponse = {
        success: false,
        error: authResult.error || "Unauthorized",
        statusCode: 401,
      }
      return NextResponse.json(errorData, { status: 401 })
    }

    const { user } = authResult

    // Only customers can create payments for their own invoices
    if (user?.role !== "customer") {
      const errorData: ErrorResponse = {
        success: false,
        error: "Only customers can create payments",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const body = await request.json()
    const { invoiceId, paymentMethod, amount, useCreditBalance, creditBalanceAmount, paymentMethodId } = body

    if (!invoiceId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "invoiceId is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (!paymentMethod || !["card", "credit_balance", "both"].includes(paymentMethod)) {
      const errorData: ErrorResponse = {
        success: false,
        error: "paymentMethod must be 'card', 'credit_balance', or 'both'",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const result = await processInvoicePayment({
      invoiceId,
      customerId: user.id,
      paymentMethod,
      amount,
      useCreditBalance,
      creditBalanceAmount,
      paymentMethodId,
    })

    const responseData: PaymentResponse & { clientSecret?: string } = {
      success: true,
      data: result.payment,
      clientSecret: result.clientSecret,
      message: result.message,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error processing payment:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process payment",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

