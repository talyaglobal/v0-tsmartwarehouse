import { type NextRequest, NextResponse } from "next/server"
import { getIncidents, createIncident } from "@/lib/db/incidents"
import { handleApiError } from "@/lib/utils/logger"
import { getNotificationService } from "@/lib/notifications/service"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createIncidentSchema } from "@/lib/validation/schemas"
import type { IncidentStatus, IncidentSeverity } from "@/types"
import type { IncidentsListResponse, IncidentResponse, ErrorResponse } from "@/types/api"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") as IncidentStatus | null
    const severity = searchParams.get("severity") as IncidentSeverity | null
    const reportedBy = searchParams.get("reportedBy")
    const warehouseId = searchParams.get("warehouseId")

    const filters: {
      reportedBy?: string
      status?: IncidentStatus
      severity?: IncidentSeverity
      warehouseId?: string
      affectedBookingId?: string
    } = {}

    if (status) filters.status = status
    if (severity) filters.severity = severity
    if (reportedBy) filters.reportedBy = reportedBy
    if (warehouseId) filters.warehouseId = warehouseId

    const incidents = await getIncidents(filters)

    const responseData: IncidentsListResponse = {
      success: true,
      data: incidents,
      total: incidents.length,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/incidents" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate with Zod schema
    let validatedData
    try {
      validatedData = createIncidentSchema.parse(body)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        const errorData: ErrorResponse = {
          success: false,
          error: "Validation error",
          statusCode: 400,
          code: "VALIDATION_ERROR",
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    // Create incident using database function
    const newIncident = await createIncident({
      ...validatedData,
      status: "open",
      reportedBy: "system", // Default value - should be replaced with authenticated user ID
      reportedByName: "System", // Default value - should be replaced with authenticated user name
    })

    // Send notification to admins
    try {
      const supabase = createServerSupabaseClient()
      const notificationService = getNotificationService()

      // Get all admin users
      const { data: admins } = await supabase
        .from("users")
        .select("id")
        .eq("role", "admin")

      if (admins && admins.length > 0) {
        const adminIds = admins.map((a) => a.id)
        const channels: ("email" | "sms" | "push" | "whatsapp")[] = ["email", "push"]
        
        // For high severity incidents, also send SMS
        if (body.severity === "high" || body.severity === "critical") {
          channels.push("sms")
        }

        await notificationService.sendBulkNotification(adminIds, {
          type: "incident",
          channels,
          title: "New Incident Reported",
          message: `${newIncident.severity.toUpperCase()} severity incident: ${newIncident.title}. ${newIncident.description}`,
          template: "incident-reported",
          templateData: {
            incidentId: newIncident.id.slice(0, 8),
            incidentType: newIncident.type,
            severity: newIncident.severity,
            description: newIncident.description,
            location: newIncident.location,
            reportedBy: newIncident.reportedByName,
            recipientName: "Admin",
          },
        })
      }
    } catch (error) {
      // Log error but don't fail the incident creation
      console.error("Failed to send incident notification:", error)
    }

    const responseData: IncidentResponse = {
      success: true,
      data: newIncident,
      message: "Incident reported successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/incidents", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
