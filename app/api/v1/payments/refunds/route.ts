import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/api-middleware"
import { processRefund } from "@/lib/business-logic/payments"
import { getRefunds } from "@/lib/db/payments"

/**
 * GET /api/v1/payments/refunds
 * List refunds with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 })
    }

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get("paymentId")
    const invoiceId = searchParams.get("invoiceId")
    const status = searchParams.get("status")

    // Customers can only see their own refunds
    // Admins can see all refunds
    const filters: any = {}
    if (user.role === "customer") {
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

    return NextResponse.json({
      success: true,
      data: refunds,
      total: refunds.length,
    })
  } catch (error) {
    console.error("Error fetching refunds:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch refunds",
      },
      { status: 500 }
    )
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
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 })
    }

    const { user } = authResult

    // Only admins can create refunds
    if (user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Only admins can create refunds" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { paymentId, amount, reason, refundToCredit } = body

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: "paymentId is required" },
        { status: 400 }
      )
    }

    const refund = await processRefund({
      paymentId,
      amount,
      reason,
      refundToCredit,
    })

    return NextResponse.json({
      success: true,
      data: refund,
      message: "Refund processed successfully",
    })
  } catch (error) {
    console.error("Error processing refund:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process refund",
      },
      { status: 500 }
    )
  }
}

