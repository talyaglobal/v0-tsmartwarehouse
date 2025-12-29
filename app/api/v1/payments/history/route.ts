import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/api-middleware"
import { getPaymentHistory } from "@/lib/business-logic/payments"
import type { PaymentHistoryResponse, ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/payments/history
 * Get payment history for the authenticated customer
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

    // Only customers can view their own payment history
    if (user?.role !== "customer") {
      const errorData: ErrorResponse = {
        success: false,
        error: "Only customers can view payment history",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const history = await getPaymentHistory(user.id)

    const responseData: PaymentHistoryResponse = {
      success: true,
      data: history.transactions,
      total: history.transactions.length,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error fetching payment history:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch payment history",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

