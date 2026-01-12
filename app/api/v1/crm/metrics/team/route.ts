import { type NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const teamMetricsQuerySchema = z.object({
  period: z.enum(["day", "month", "quarter", "year"]).default("month"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    // Require admin role
    const authResult = await requireRole(request, ["root", "warehouse_admin", "warehouse_admin"])
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
      validatedParams = teamMetricsQuerySchema.parse(queryParams)
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

    // Get team members (warehouse_finder and reseller roles in same company)
    let teamQuery = supabase
      .from("profiles")
      .select("id, name, email, role")
      .in("role", ["warehouse_finder", "reseller"])

    if (profile.role !== "root" && profile.company_id) {
      teamQuery = teamQuery.eq("company_id", profile.company_id)
    }

    const { data: teamMembers, error: teamError } = await teamQuery

    if (teamError) {
      return NextResponse.json(
        { success: false, error: teamError.message },
        { status: 500 }
      )
    }

    // Get metrics for each team member
    const teamMetrics = await Promise.all(
      (teamMembers || []).map(async (member) => {
        let query = supabase
          .from("crm_performance_metrics")
          .select("*")
          .eq("user_id", member.id)
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
          const now = new Date()
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
          query = query.gte("metric_month", firstDayOfMonth)
        } else if (validatedParams.period === "quarter") {
          const now = new Date()
          const quarter = Math.floor(now.getMonth() / 3)
          const firstDayOfQuarter = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split("T")[0]
          query = query.gte("metric_month", firstDayOfQuarter)
        } else if (validatedParams.period === "year") {
          const now = new Date()
          const firstDayOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]
          query = query.gte("metric_month", firstDayOfYear)
        }

        const { data: metrics } = await query.limit(100)

        const aggregated = {
          totalContactsCreated: (metrics || []).reduce((sum, m) => sum + (m.contacts_created || 0), 0),
          totalCallsMade: (metrics || []).reduce((sum, m) => sum + (m.calls_made || 0), 0),
          totalEmailsSent: (metrics || []).reduce((sum, m) => sum + (m.emails_sent || 0), 0),
          totalVisitsConducted: (metrics || []).reduce((sum, m) => sum + (m.visits_conducted || 0), 0),
          totalContactsConverted: (metrics || []).reduce((sum, m) => sum + (m.contacts_converted || 0), 0),
          totalRevenueGenerated: (metrics || []).reduce((sum, m) => sum + Number(m.total_revenue_generated || 0), 0),
          averageConversionRate: (metrics || []).length > 0
            ? (metrics || []).reduce((sum, m) => sum + Number(m.conversion_rate || 0), 0) / (metrics || []).length
            : 0,
        }

        return {
          user: {
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role,
          },
          metrics: metrics || [],
          aggregated,
        }
      })
    )

    // Calculate team totals
    const teamTotals = {
      totalContactsCreated: teamMetrics.reduce((sum, m) => sum + m.aggregated.totalContactsCreated, 0),
      totalCallsMade: teamMetrics.reduce((sum, m) => sum + m.aggregated.totalCallsMade, 0),
      totalEmailsSent: teamMetrics.reduce((sum, m) => sum + m.aggregated.totalEmailsSent, 0),
      totalVisitsConducted: teamMetrics.reduce((sum, m) => sum + m.aggregated.totalVisitsConducted, 0),
      totalContactsConverted: teamMetrics.reduce((sum, m) => sum + m.aggregated.totalContactsConverted, 0),
      totalRevenueGenerated: teamMetrics.reduce((sum, m) => sum + m.aggregated.totalRevenueGenerated, 0),
      averageConversionRate: teamMetrics.length > 0
        ? teamMetrics.reduce((sum, m) => sum + m.aggregated.averageConversionRate, 0) / teamMetrics.length
        : 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        teamMembers: teamMetrics,
        teamTotals,
      },
    })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to fetch team metrics" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

