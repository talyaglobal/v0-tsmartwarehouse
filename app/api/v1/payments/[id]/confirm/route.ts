import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/api-middleware"
import { confirmPayment } from "@/lib/business-logic/payments"

/**
 * POST /api/v1/payments/[id]/confirm
 * Confirm a payment after client-side confirmation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 })
    }

    const { user } = authResult
    const paymentId = params.id

    const body = await request.json()
    const { paymentMethodId } = body

    const payment = await confirmPayment(paymentId, paymentMethodId)

    // Verify user owns this payment
    if (user.role === "customer" && payment.customerId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: payment,
      message: "Payment confirmed successfully",
    })
  } catch (error) {
    console.error("Error confirming payment:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to confirm payment",
      },
      { status: 500 }
    )
  }
}

