import { NextRequest, NextResponse } from 'next/server'
import { getCustomerPaymentRemaining, getCustomerPaymentSummary } from '@/lib/db/payments'
import { handleApiError } from '@/lib/utils/logger'

/**
 * GET /api/v1/customers/[id]/payment-remaining
 * Get total payment remaining for customer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const searchParams = request.nextUrl.searchParams
    const summary = searchParams.get('summary') === 'true'

    if (summary) {
      // Get full payment summary
      const paymentSummary = await getCustomerPaymentSummary(resolvedParams.id)
      return NextResponse.json({
        success: true,
        data: paymentSummary,
      })
    }

    // Get just the remaining balance
    const remaining = await getCustomerPaymentRemaining(resolvedParams.id)
    return NextResponse.json({
      success: true,
      data: {
        remainingBalance: remaining,
      },
    })
  } catch (error: any) {
    const errorResponse = handleApiError(error, { context: 'Failed to get customer payment remaining' })
    return NextResponse.json(
      {
        error: errorResponse.message,
        ...(errorResponse.code && { code: errorResponse.code }),
      },
      { status: errorResponse.statusCode }
    )
  }
}

