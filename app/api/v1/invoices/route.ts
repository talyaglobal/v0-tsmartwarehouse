import { type NextRequest, NextResponse } from "next/server"
import { getInvoices } from "@/lib/db/invoices"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import { invoicesQuerySchema } from "@/lib/validation/schemas"
import type { InvoiceStatus } from "@/types"
import type { InvoicesListResponse, ErrorResponse } from "@/types/api"

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

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

    // Check if user is company admin
    const userCompanyId = await getUserCompanyId(user.id)
    const isAdmin = userCompanyId ? await isCompanyAdmin(user.id, userCompanyId) : false

    const filters: {
      customerId?: string
      companyId?: string
      status?: InvoiceStatus
      bookingId?: string
    } = {}

    if (validatedParams.customerId) {
      // If user is company admin, they can see invoices of users in their company
      if (isAdmin && userCompanyId) {
        // Verify the requested customerId belongs to the same company
        const { createServerSupabaseClient } = await import('@/lib/supabase/server')
        const supabase = createServerSupabaseClient()
        const { data: customerProfile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', validatedParams.customerId)
          .single()
        
        if (customerProfile?.company_id === userCompanyId) {
          filters.customerId = validatedParams.customerId
        } else {
          // Customer doesn't belong to admin's company
          filters.customerId = user.id // Fallback to own invoices
        }
      } else {
        filters.customerId = validatedParams.customerId
      }
    } else {
      if (isAdmin && userCompanyId) {
        // Company admin - show all invoices from their company
        filters.companyId = userCompanyId
      } else {
        // Regular user - show only their invoices
        filters.customerId = user.id
      }
    }

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
