import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/api-middleware"
import { processRefund } from "@/lib/business-logic/payments"
import { getRefunds } from "@/lib/db/payments"
import type { RefundsListResponse, RefundResponse, ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/payments/refunds
 * List refunds with optional filters
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
    const paymentId = searchParams.get("paymentId")
    const invoiceId = searchParams.get("invoiceId")
    const status = searchParams.get("status")

    // Customers can only see their own refunds
    // Admins can see all refunds
    const filters: any = {}
    if (user?.role === "warehouse_client") {
      filters.customerId = user.id
    } else if (paymentId) {
      filters.paymentId = paymentId
    }
    if (invoiceId) {
      filters.invoiceId = invoiceId
    }
    if (status) {
      filters.status = status
    }

    const refunds = await getRefunds(filters)

    const responseData: RefundsListResponse = {
      success: true,
      data: refunds,
      total: refunds.length,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error fetching refunds:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch refunds",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

/**
 * POST /api/v1/payments/refunds
 * Create a refund for a payment
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

    // Only root, warehouse admins and supervisors can create refunds
    if (!['root', 'warehouse_admin', 'warehouse_supervisor'].includes(user?.role || '')) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Only root and company admins can create refunds",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const body = await request.json()
    const { paymentId, amount, reason, refundToCredit } = body

    if (!paymentId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "paymentId is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const refund = await processRefund({
      paymentId,
      amount,
      reason,
      refundToCredit,
    })

    const responseData: RefundResponse = {
      success: true,
      data: refund,
      message: "Refund processed successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error processing refund:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process refund",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

