import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/api-middleware"
import { getPaymentHistory } from "@/lib/business-logic/payments"

/**
 * GET /api/v1/payments/history
 * Get payment history for the authenticated customer
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 })
    }

    const { user } = authResult

    // Only customers can view their own payment history
    if (user.role !== "customer") {
      return NextResponse.json(
        { success: false, error: "Only customers can view payment history" },
        { status: 403 }
      )
    }

    const history = await getPaymentHistory(user.id)

    return NextResponse.json({
      success: true,
      data: history,
    })
  } catch (error) {
    console.error("Error fetching payment history:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch payment history",
      },
      { status: 500 }
    )
  }
}

