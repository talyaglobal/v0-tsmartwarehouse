import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getUserCompanyId, isCompanyAdmin } from "@/lib/auth/company-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ApiResponse, ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/teams/booking-members
 * Get team members that the current user can book on behalf of (same company's teams).
 * Query param: forCustomerId – when editing a booking request, pass the request's customer_id
 * to get members from that customer's company (all same-company members; no partner-only filter).
 * When forCustomerId is absent (create flow), only "partner" members are returned (profile.company_id !== team company).
 * Uses admin client so RLS does not hide any members. Returns { members, isTeamAdmin }.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const userId = authResult.user.id
    const { searchParams } = new URL(request.url)
    const forCustomerId = searchParams.get("forCustomerId")?.trim() || null

    const admin = createAdminClient()

    let companyId: string | null
    let excludeMemberId: string | null = userId

    if (forCustomerId) {
      const { data: customerProfile, error: profileError } = await admin
        .from("profiles")
        .select("company_id")
        .eq("id", forCustomerId)
        .single()

      if (profileError || !customerProfile?.company_id) {
        return NextResponse.json({
          success: true,
          data: { members: [], isTeamAdmin: false },
        })
      }

      companyId = customerProfile.company_id
      const allowed =
        userId === forCustomerId || (await isCompanyAdmin(userId, companyId))
      if (!allowed) {
        return NextResponse.json({
          success: true,
          data: { members: [], isTeamAdmin: false },
        })
      }
      excludeMemberId = null
    } else {
      companyId = await getUserCompanyId(userId)
      if (!companyId) {
        return NextResponse.json({
          success: true,
          data: { members: [], isTeamAdmin: false },
        })
      }
    }

    const { data: teams, error: teamsError } = await admin
      .from("client_teams")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("status", true)

    if (teamsError || !teams?.length) {
      if (forCustomerId) {
        const { data: customerProfile } = await admin
          .from("profiles")
          .select("id, name, email")
          .eq("id", forCustomerId)
          .single()
        if (customerProfile) {
          return NextResponse.json({
            success: true,
            data: {
              members: [
                {
                  memberId: customerProfile.id,
                  name: customerProfile.name ?? null,
                  email: customerProfile.email ?? null,
                  avatar: null,
                  teamId: "",
                  teamName: "",
                  companyName: null,
                },
              ],
              isTeamAdmin: false,
            },
          })
        }
      }
      return NextResponse.json({
        success: true,
        data: { members: [], isTeamAdmin: false },
      })
    }

    const teamIds = teams.map((t) => t.id)
    const teamNameById = Object.fromEntries(teams.map((t) => [t.id, t.name || ""]))

    let membersQuery = admin
      .from("client_team_members")
      .select("member_id, team_id, role")
      .in("team_id", teamIds)
    if (excludeMemberId) {
      membersQuery = membersQuery.neq("member_id", excludeMemberId)
    }
    const { data: membersRows, error: membersError } = await membersQuery

    if (membersError) {
      const errorData: ErrorResponse = {
        success: false,
        error: membersError.message,
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    let memberIds = [...new Set((membersRows || []).map((r: { member_id: string }) => r.member_id))]

    if (memberIds.length === 0 && forCustomerId) {
      const { data: customerProfile } = await admin
        .from("profiles")
        .select("id, name, email")
        .eq("id", forCustomerId)
        .single()
      if (customerProfile) {
        const { data: adminRole } = await admin
          .from("client_team_members")
          .select("role")
          .eq("member_id", userId)
          .in("team_id", teamIds)
          .eq("role", "admin")
          .limit(1)
          .maybeSingle()
        return NextResponse.json({
          success: true,
          data: {
            members: [
              {
                memberId: customerProfile.id,
                name: customerProfile.name ?? null,
                email: customerProfile.email ?? null,
                avatar: null,
                teamId: "",
                teamName: "",
                companyName: null,
              },
            ],
            isTeamAdmin: !!adminRole,
          },
        })
      }
    }

    if (memberIds.length === 0) {
      let isTeamAdminUser = false
      const { data: myRole } = await admin
        .from("client_team_members")
        .select("role")
        .eq("member_id", userId)
        .in("team_id", teamIds)
        .eq("role", "admin")
        .limit(1)
        .maybeSingle()
      isTeamAdminUser = !!myRole
      return NextResponse.json({
        success: true,
        data: { members: [], isTeamAdmin: isTeamAdminUser },
      })
    }

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, name, email, avatar_url, company_id")
      .in("id", memberIds)

    if (profilesError) {
      const errorData: ErrorResponse = {
        success: false,
        error: profilesError.message,
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    const profileById = (profiles || []).reduce((acc: Record<string, { id: string; name?: string; email?: string; avatar_url?: string; company_id?: string | null }>, p) => {
      acc[p.id] = p
      return acc
    }, {})

    const otherCompanyIds = [...new Set((profiles || []).map((p: { company_id?: string | null }) => p.company_id).filter((id: string | undefined | null) => id && id !== companyId))]
    let companyNameById: Record<string, string> = {}
    if (otherCompanyIds.length > 0) {
      const { data: companies } = await admin
        .from("companies")
        .select("id, short_name, trading_name")
        .in("id", otherCompanyIds)
      ;(companies || []).forEach((c: { id: string; short_name?: string; trading_name?: string }) => {
        companyNameById[c.id] = c.short_name || c.trading_name || "Unknown"
      })
    }

    const memberToTeam: Record<string, { teamId: string; teamName: string }> = {}
    ;(membersRows || []).forEach((r: { member_id: string; team_id: string }) => {
      if (!memberToTeam[r.member_id]) {
        memberToTeam[r.member_id] = {
          teamId: r.team_id,
          teamName: teamNameById[r.team_id] || "",
        }
      }
    })

    const { data: adminRole } = await admin
      .from("client_team_members")
      .select("role")
      .eq("member_id", userId)
      .in("team_id", teamIds)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle()
    const isTeamAdminUser = !!adminRole

    const allMembers = memberIds.map((id) => {
      const p = profileById[id] || {}
      const { teamId, teamName } = memberToTeam[id] || { teamId: "", teamName: "" }
      const memberCompanyId = p.company_id
      const companyName = memberCompanyId && memberCompanyId !== companyId ? (companyNameById[memberCompanyId] ?? null) : null
      return {
        memberId: id,
        name: p.name ?? null,
        email: p.email ?? null,
        avatar: p.avatar_url ?? null,
        teamId,
        teamName,
        companyName: companyName ?? null,
      }
    })

    const members = forCustomerId
      ? allMembers
      : allMembers.filter((m) => m.companyName != null)

    const responseData: ApiResponse = {
      success: true,
      data: { members, isTeamAdmin: isTeamAdminUser },
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/teams/booking-members" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
