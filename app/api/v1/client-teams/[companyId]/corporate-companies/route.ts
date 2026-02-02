import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * GET /api/v1/client-teams/[companyId]/corporate-companies
 * List other corporate (client_company) companies with their admin user.
 * Used to add another company's admin to your team.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const authResult = await requireAuth(_request)
    if (authResult instanceof NextResponse) return authResult

    const { companyId } = await params
    const supabase = createServerSupabaseClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', authResult.user.id)
      .single()

    if (!profile?.company_id || profile.company_id !== companyId) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const companiesQuery = adminClient
      .from('companies')
      .select('id, short_name, trading_name')
      .eq('type', 'client_company')
      .eq('status', true)
      .neq('id', companyId)
      .order('short_name', { ascending: true })

    const { data: companies, error: companiesError } = await companiesQuery

    if (companiesError) {
      return NextResponse.json({ error: companiesError.message }, { status: 500 })
    }

    if (!companies?.length) {
      return NextResponse.json({ success: true, data: [] })
    }

    const otherCompanyIds = companies.map((c) => c.id)

    const { data: teams } = await adminClient
      .from('client_teams')
      .select('id, company_id')
      .in('company_id', otherCompanyIds)
      .eq('status', true)

    const teamIdsByCompany: Record<string, string[]> = {}
    ;(teams ?? []).forEach((t: { id: string; company_id: string }) => {
      if (!teamIdsByCompany[t.company_id]) teamIdsByCompany[t.company_id] = []
      teamIdsByCompany[t.company_id].push(t.id)
    })

    const { data: adminRows } = await adminClient
      .from('client_team_members')
      .select('member_id, team_id')
      .eq('role', 'admin')
      .in('team_id', (teams ?? []).map((t: { id: string }) => t.id))

    const adminUserIdByTeam: Record<string, string> = {}
    ;(adminRows ?? []).forEach((r: { member_id: string; team_id: string }) => {
      if (!adminUserIdByTeam[r.team_id]) adminUserIdByTeam[r.team_id] = r.member_id
    })

    const companyToTeamId: Record<string, string> = {}
    ;(teams ?? []).forEach((t: { id: string; company_id: string }) => {
      if (!companyToTeamId[t.company_id] && adminUserIdByTeam[t.id]) {
        companyToTeamId[t.company_id] = t.id
      }
    })

    const adminUserIds = [...new Set(Object.values(adminUserIdByTeam))]
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, email, name')
      .in('id', adminUserIds)

    const profileMap = (profiles ?? []).reduce((acc: Record<string, { id: string; email: string; name: string | null }>, p: { id: string; email: string; name: string | null }) => {
      acc[p.id] = p
      return acc
    }, {})

    const list: { id: string; name: string; admin: { id: string; email: string; name: string | null } }[] = []

    for (const c of companies) {
      const teamIds = teamIdsByCompany[c.id] ?? []
      let adminId: string | null = null
      for (const tid of teamIds) {
        if (adminUserIdByTeam[tid]) {
          adminId = adminUserIdByTeam[tid]
          break
        }
      }
      const adminProfile = adminId ? profileMap[adminId] : null
      if (adminProfile) {
        list.push({
          id: c.id,
          name: (c as { short_name?: string; trading_name?: string }).short_name || (c as { trading_name?: string }).trading_name || 'Unknown',
          admin: {
            id: adminProfile.id,
            email: adminProfile.email,
            name: adminProfile.name,
          },
        })
      }
    }

    return NextResponse.json({ success: true, data: list })
  } catch (error) {
    console.error('Error listing corporate companies:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
