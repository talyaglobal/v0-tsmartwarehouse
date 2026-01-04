import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { proposeDateChange } from "@/lib/business-logic/warehouse-staff"
import { getNotificationService } from "@/lib/notifications/service"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const proposeDateChangeSchema = z.object({
  proposedStartDate: z.string(), // YYYY-MM-DD format
  proposedStartTime: z.string(), // HH:mm format
  reason: z.string().optional(),
})

/**
 * POST /api/v1/bookings/[id]/propose-date-change
 * Warehouse staff proposes a new date/time for a booking
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult

    // Verify user is warehouse staff
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'warehouse_staff') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Only warehouse staff can perform this action",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Resolve params (Next.js 15+ compatibility)
    const resolvedParams = await Promise.resolve(params)
    const bookingId = resolvedParams.id

    console.log(`[propose-date-change API] Received request for bookingId: ${bookingId}, userId: ${user.id}`)
    const body = await request.json()

    // Validate request body
    let validatedData
    try {
      validatedData = proposeDateChangeSchema.parse(body)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        const errorData: ErrorResponse = {
          success: false,
          error: "Validation error",
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: zodError.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", "),
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    const { proposedStartDate, proposedStartTime, reason } = validatedData

    // Propose date change
    const updatedBooking = await proposeDateChange(
      bookingId,
      proposedStartDate,
      proposedStartTime,
      user.id
    )

    // Send notification to customer
    try {
      const notificationService = getNotificationService()
      await notificationService.sendNotification({
        userId: updatedBooking.customerId,
        type: "booking",
        channels: ["push", "email"],
        title: "New Date/Time Proposed",
        message: `Warehouse staff has proposed a new date/time for your booking ${updatedBooking.id}. Please review and confirm.`,
        metadata: {
          bookingId: updatedBooking.id,
          proposedStartDate: updatedBooking.proposedStartDate,
          proposedStartTime: updatedBooking.proposedStartTime,
          reason: reason,
          notificationSubType: "date_change_proposed",
        },
      })
    } catch (notificationError) {
      console.error("Failed to send notification:", notificationError)
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: "Date/time change proposed successfully",
    })
  } catch (error) {
    console.error("Error proposing date change:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to propose date change",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

