import { type NextRequest, NextResponse } from "next/server"
import { getInvoices } from "@/lib/db/invoices"
import { handleApiError } from "@/lib/utils/logger"
import { invoicesQuerySchema } from "@/lib/validation/schemas"
import type { InvoiceStatus } from "@/types"
import type { InvoicesListResponse, ErrorResponse } from "@/types/api"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Validate query parameters
    const queryParams: Record<string, string | undefined> = {}
    searchParams.forEach((value, key) => {
      queryParams[key] = value
    })

    let validatedParams
    try {
      validatedParams = invoicesQuerySchema.parse(queryParams)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Invalid query parameters",
          statusCode: 400,
          code: "VALIDATION_ERROR",
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    const filters: {
      customerId?: string
      status?: InvoiceStatus
      bookingId?: string
    } = {}

    if (validatedParams.customerId) filters.customerId = validatedParams.customerId
    if (validatedParams.status) filters.status = validatedParams.status
    if (validatedParams.bookingId) filters.bookingId = validatedParams.bookingId

    const invoices = await getInvoices(filters)

    const responseData: InvoicesListResponse = {
      success: true,
      data: invoices,
      total: invoices.length,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/invoices" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
