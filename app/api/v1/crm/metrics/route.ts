import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const metricsQuerySchema = z.object({
  period: z.enum(["day", "month", "quarter", "year"]).default("month"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  user_id: z.string().uuid().optional(), // For admin viewing team metrics
})

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const supabase = createServerSupabaseClient()

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single()

    if (!profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "User profile not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams: Record<string, string | undefined> = {}
    searchParams.forEach((value, key) => {
      queryParams[key] = value
    })

    let validatedParams
    try {
      validatedParams = metricsQuerySchema.parse(queryParams)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        const errorData: ErrorResponse = {
          success: false,
          error: "Invalid query parameters",
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: zodError.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", "),
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    // Determine target user ID
    let targetUserId = user.id

    // If admin requesting team metrics
    if (validatedParams.user_id) {
      if (!["root", "warehouse_admin", "warehouse_admin"].includes(profile.role)) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }

      // Verify user belongs to same company (for non-root admins)
      if (profile.role !== "root" && profile.company_id) {
        const { data: targetProfile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", validatedParams.user_id)
          .single()

        if (!targetProfile || targetProfile.company_id !== profile.company_id) {
          return NextResponse.json(
            { success: false, error: "Forbidden" },
            { status: 403 }
          )
        }
      }

      targetUserId = validatedParams.user_id
    }

    // Build query
    let query = supabase
      .from("crm_performance_metrics")
      .select("*")
      .eq("user_id", targetUserId)
      .order("metric_date", { ascending: false })

    // Apply date filters
    if (validatedParams.start_date) {
      query = query.gte("metric_date", validatedParams.start_date)
    }
    if (validatedParams.end_date) {
      query = query.lte("metric_date", validatedParams.end_date)
    }

    // Apply period filter
    if (validatedParams.period === "month") {
      // Get current month
      const now = new Date()
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
      query = query.gte("metric_month", firstDayOfMonth)
    } else if (validatedParams.period === "quarter") {
      // Get current quarter
      const now = new Date()
      const quarter = Math.floor(now.getMonth() / 3)
      const firstDayOfQuarter = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split("T")[0]
      query = query.gte("metric_month", firstDayOfQuarter)
    } else if (validatedParams.period === "year") {
      // Get current year
      const now = new Date()
      const firstDayOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]
      query = query.gte("metric_month", firstDayOfYear)
    }

    const { data: metrics, error } = await query.limit(100)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Calculate aggregated metrics
    const aggregated = {
      totalContactsCreated: (metrics || []).reduce((sum, m) => sum + (m.contacts_created || 0), 0),
      totalCallsMade: (metrics || []).reduce((sum, m) => sum + (m.calls_made || 0), 0),
      totalEmailsSent: (metrics || []).reduce((sum, m) => sum + (m.emails_sent || 0), 0),
      totalVisitsConducted: (metrics || []).reduce((sum, m) => sum + (m.visits_conducted || 0), 0),
      totalMeetingsHeld: (metrics || []).reduce((sum, m) => sum + (m.meetings_held || 0), 0),
      totalContactsConverted: (metrics || []).reduce((sum, m) => sum + (m.contacts_converted || 0), 0),
      totalRevenueGenerated: (metrics || []).reduce((sum, m) => sum + Number(m.total_revenue_generated || 0), 0),
      averageConversionRate: (metrics || []).length > 0
        ? (metrics || []).reduce((sum, m) => sum + Number(m.conversion_rate || 0), 0) / (metrics || []).length
        : 0,
      averageDaysToConvert: (metrics || []).length > 0
        ? (metrics || []).reduce((sum, m) => sum + Number(m.average_days_to_convert || 0), 0) / (metrics || []).length
        : 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics: metrics || [],
        aggregated,
      },
    })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to fetch CRM metrics" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

