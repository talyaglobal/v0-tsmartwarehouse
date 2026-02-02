import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-middleware'
import { isCompanyAdmin } from '@/lib/auth/company-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET - List client team members for the company (server-side so RLS does not hide newly added members)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const authResult = await requireAuth(_request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { companyId } = await params
    const supabase = await createServerSupabaseClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', authResult.user.id)
      .single()

    const userCompanyId = profile?.company_id
    if (!userCompanyId || userCompanyId !== companyId) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 })
    }

    const { data: teams } = await supabase
      .from('client_teams')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', true)

    if (!teams?.length) {
      return NextResponse.json({ success: true, data: [] })
    }

    const teamIds = teams.map((t) => t.id)
    const { data: membersRows, error: membersError } = await supabase
      .from('client_team_members')
      .select(`
        member_id,
        role,
        joined_at,
        client_teams:team_id (id, name)
      `)
      .in('team_id', teamIds)

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 })
    }

    const memberIds = [...new Set((membersRows || []).map((r: any) => r.member_id))]
    if (memberIds.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const adminClient = createAdminClient()
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, name, email, phone, avatar_url, company_id, created_at, updated_at')
      .in('id', memberIds)

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 })
    }

    const otherCompanyIds = [...new Set((profiles || []).map((p: any) => p.company_id).filter((id: string | null) => id && id !== companyId))]
    let companyNameMap: Record<string, string> = {}
    if (otherCompanyIds.length > 0) {
      const { data: companies } = await adminClient
        .from('companies')
        .select('id, short_name, trading_name')
        .in('id', otherCompanyIds)
      ;(companies || []).forEach((c: any) => {
        companyNameMap[c.id] = c.short_name || c.trading_name || 'Unknown'
      })
    }

    const roleMap: Record<string, 'admin' | 'member'> = {}
    const joinedAtMap: Record<string, string | null> = {}
    const teamsByMember: Record<string, { id: string; name: string }[]> = {}
    ;(membersRows || []).forEach((r: any) => {
      if (!roleMap[r.member_id] || r.role === 'admin') {
        roleMap[r.member_id] = r.role === 'admin' ? 'admin' : 'member'
        joinedAtMap[r.member_id] = r.joined_at ?? null
      }
      const team = (r as any).client_teams
      if (team?.id && team?.name) {
        if (!teamsByMember[r.member_id]) teamsByMember[r.member_id] = []
        if (!teamsByMember[r.member_id].some((t) => t.id === team.id)) {
          teamsByMember[r.member_id].push({ id: team.id, name: team.name })
        }
      }
    })

    const list = (profiles || []).map((profile: any) => {
      const memberCompanyId = profile.company_id
      const company_name = memberCompanyId && memberCompanyId !== companyId ? companyNameMap[memberCompanyId] ?? null : null
      return {
        id: profile.id,
        user_id: profile.id,
        company_id: companyId,
        role: roleMap[profile.id] ?? 'member',
        invited_by: null,
        joined_at: joinedAtMap[profile.id] ?? profile.created_at,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        teams: teamsByMember[profile.id] ?? [],
        company_name,
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          avatar_url: profile.avatar_url,
        },
      }
    })

    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ success: true, data: list })
  } catch (error) {
    console.error('Error listing client team members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add a new member (create user or add existing user by email)
// Body: { email, fullName?, role, password?, teamId? }
// - If fullName and password provided: create new user in company and add to team (or default team).
// - If only email (and role, teamId?): add existing user by email to team (user can be from any company).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { companyId } = await params
    const body = await request.json()
    const { email, fullName, role, password, teamId, corporateCompanyId } = body

    const hasCorporateCompany = corporateCompanyId && typeof corporateCompanyId === 'string' && corporateCompanyId.trim()
    const hasEmail = email && typeof email === 'string' && email.trim()
    const hasNewUserFields = fullName && password

    if (!hasCorporateCompany && !hasEmail) {
      return NextResponse.json({ error: 'Select a company or enter an email' }, { status: 400 })
    }

    const isAdmin = await isCompanyAdmin(user.id, companyId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only team admins can add members' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const resolveTeam = async (): Promise<{ id: string }> => {
      if (teamId) {
        const { data: t, error } = await adminClient
          .from('client_teams')
          .select('id')
          .eq('id', teamId)
          .eq('company_id', companyId)
          .eq('status', true)
          .maybeSingle()
        if (error || !t) {
          throw new Error('Invalid or inaccessible team')
        }
        return t
      }
      const { data: defaultTeam, error: teamError } = await adminClient
        .from('client_teams')
        .select('id')
        .eq('company_id', companyId)
        .eq('status', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (teamError || !defaultTeam) {
        throw new Error('No team found for this company')
      }
      return defaultTeam
    }

    const addExistingUserToTeam = async (memberUserId: string) => {
      const team = await resolveTeam()

      const { error: memberInsertError } = await adminClient
        .from('client_team_members')
        .insert({
          team_id: team.id,
          member_id: memberUserId,
          role: role === 'admin' ? 'admin' : 'member',
          invited_by: user.id,
        })

      if (memberInsertError) {
        if (memberInsertError.code === '23505') {
          return NextResponse.json({ error: 'User is already in this team' }, { status: 409 })
        }
        return NextResponse.json({ error: memberInsertError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'User added to team',
        userId: memberUserId,
      })
    }

    const addExistingUserByEmail = async () => {
      const { data: existingProfile, error: profileErr } = await adminClient
        .from('profiles')
        .select('id')
        .ilike('email', email.trim())
        .limit(1)
        .maybeSingle()

      if (profileErr || !existingProfile) {
        return NextResponse.json({ error: 'No user found with this email' }, { status: 404 })
      }

      return addExistingUserToTeam(existingProfile.id)
    }

    const addCorporateCompanyAdmin = async () => {
      if (corporateCompanyId.trim() === companyId) {
        return NextResponse.json({ error: 'Cannot add your own company' }, { status: 400 })
      }

      const otherCompanyId = corporateCompanyId.trim()
      const { data: otherTeams } = await adminClient
        .from('client_teams')
        .select('id')
        .eq('company_id', otherCompanyId)
        .eq('status', true)

      if (!otherTeams?.length) {
        return NextResponse.json({ error: 'No team found for that company' }, { status: 404 })
      }

      const teamIds = otherTeams.map((t) => t.id)
      const { data: adminMember, error: adminErr } = await adminClient
        .from('client_team_members')
        .select('member_id')
        .in('team_id', teamIds)
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle()

      if (adminErr || !adminMember) {
        return NextResponse.json({ error: 'No admin found for that company' }, { status: 404 })
      }

      const response = await addExistingUserToTeam(adminMember.member_id)
      if (response.status !== 200) return response

      const { data: otherDefaultTeam } = await adminClient
        .from('client_teams')
        .select('id')
        .eq('company_id', otherCompanyId)
        .eq('status', true)
        .eq('is_default', true)
        .maybeSingle()

      const teamToAddTo = otherDefaultTeam?.id ?? otherTeams[0]?.id
      if (teamToAddTo) {
        const { error: reciprocalErr } = await adminClient
          .from('client_team_members')
          .insert({
            team_id: teamToAddTo,
            member_id: user.id,
            role: 'member',
            invited_by: adminMember.member_id,
          })
        if (reciprocalErr && reciprocalErr.code !== '23505') {
          console.error('Reciprocal add to partner team:', reciprocalErr)
        }
      }

      return response
    }

    if (hasCorporateCompany) {
      return addCorporateCompanyAdmin()
    }

    if (!hasNewUserFields) {
      return addExistingUserByEmail()
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { name: fullName },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        email: newUser.user.email ?? email.trim(),
        name: fullName,
        company_id: companyId,
        client_type: 'corporate',
        role: 'warehouse_client',
        status: true,
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Error updating profile:', profileError)
    }

    const team = await resolveTeam()

    const { error: memberInsertError } = await adminClient
      .from('client_team_members')
      .insert({
        team_id: team.id,
        member_id: newUser.user.id,
        role: role === 'admin' ? 'admin' : 'member',
        invited_by: user.id,
      })

    if (memberInsertError) {
      console.error('Error adding to client_team_members:', memberInsertError)
      return NextResponse.json({ error: 'Failed to add member to team' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Member added successfully',
      userId: newUser.user.id,
    })
  } catch (error) {
    const err = error as Error
    if (err.message === 'Invalid or inaccessible team' || err.message === 'No team found for this company') {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('Error adding member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
