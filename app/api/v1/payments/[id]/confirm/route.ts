import { type NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/api-middleware"
import { confirmPayment } from "@/lib/business-logic/payments"
import type { PaymentResponse, ErrorResponse } from "@/types/api"

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

/**
 * POST /api/v1/payments/[id]/confirm
 * Confirm a payment after client-side confirmation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
    const paymentId = id

    const body = await request.json()
    const { paymentMethodId } = body

    const payment = await confirmPayment(paymentId, paymentMethodId)

    // Verify user owns this payment
    if (user?.role === "member" && payment.customerId !== user.id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Payment not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    const responseData: PaymentResponse = {
      success: true,
      data: payment,
      message: "Payment confirmed successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error confirming payment:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to confirm payment",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

