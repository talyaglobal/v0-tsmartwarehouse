import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-middleware'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * GET /api/v1/client-teams/[companyId]
 * List teams for the company. User must belong to the same company.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const authResult = await requireAuth(_request)
    if (authResult instanceof NextResponse) return authResult

    const { companyId } = await params
    const supabase = await createServerSupabaseClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', authResult.user.id)
      .single()

    if (!profile?.company_id || profile.company_id !== companyId) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { data: teams, error: teamsError } = await adminClient
      .from('client_teams')
      .select('id, name, description, is_default, created_at')
      .eq('company_id', companyId)
      .eq('status', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (teamsError) {
      return NextResponse.json({ error: teamsError.message }, { status: 500 })
    }

    const teamIds = (teams ?? []).map((t) => t.id)
    if (teamIds.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const { data: counts } = await adminClient
      .from('client_team_members')
      .select('team_id')
      .in('team_id', teamIds)

    const countByTeam: Record<string, number> = {}
    ;(counts ?? []).forEach((r: { team_id: string }) => {
      countByTeam[r.team_id] = (countByTeam[r.team_id] ?? 0) + 1
    })

    const list = (teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? null,
      is_default: t.is_default ?? false,
      member_count: countByTeam[t.id] ?? 0,
      created_at: t.created_at,
    }))

    return NextResponse.json({ success: true, data: list })
  } catch (error) {
    console.error('Error listing client teams:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/v1/client-teams/[companyId]
 * Create a new team. Caller must be team admin or company member in same company.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult

    const { companyId } = await params
    const body = await request.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    const { isCompanyAdmin } = await import('@/lib/auth/company-admin')
    const supabaseForCheck = createServerSupabaseClient()
    const { data: existingTeams } = await supabaseForCheck
      .from('client_teams')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', true)
      .limit(1)
    const hasTeams = existingTeams && existingTeams.length > 0
    const canManage = await isCompanyAdmin(authResult.user.id, companyId)
    const { data: myProfile } = await supabaseForCheck
      .from('profiles')
      .select('company_id')
      .eq('id', authResult.user.id)
      .single()
    const sameCompany = myProfile?.company_id === companyId
    if (!canManage && !(sameCompany && !hasTeams)) {
      return NextResponse.json({ error: 'Only team admins can create teams' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { data: existing } = await adminClient
      .from('client_teams')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', true)
      .limit(1)
      .maybeSingle()

    const isFirstTeam = !existing

    const { data: team, error: insertError } = await adminClient
      .from('client_teams')
      .insert({
        company_id: companyId,
        name: name.trim(),
        description: description?.trim() || null,
        created_by: authResult.user.id,
        status: true,
        is_default: isFirstTeam,
      })
      .select('id, name, description, is_default, created_at')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'A team with this name already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        description: team.description,
        is_default: team.is_default,
        member_count: 0,
        created_at: team.created_at,
      },
    })
  } catch (error) {
    console.error('Error creating client team:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
