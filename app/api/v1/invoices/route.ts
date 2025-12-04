import { type NextRequest, NextResponse } from "next/server"
import { getInvoices } from "@/lib/db/invoices"
import { handleApiError } from "@/lib/utils/logger"
import type { InvoiceStatus } from "@/types"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId")
    const status = searchParams.get("status") as InvoiceStatus | null
    const bookingId = searchParams.get("bookingId")

    const filters: {
      customerId?: string
      status?: InvoiceStatus
      bookingId?: string
    } = {}

    if (customerId) filters.customerId = customerId
    if (status) filters.status = status
    if (bookingId) filters.bookingId = bookingId

    const invoices = await getInvoices(filters)

    return NextResponse.json({
      success: true,
      data: invoices,
      total: invoices.length,
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/invoices" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}
