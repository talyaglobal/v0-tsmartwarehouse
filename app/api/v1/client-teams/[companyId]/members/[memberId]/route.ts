import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-middleware'
import { isCompanyAdmin } from '@/lib/auth/company-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH - Update a client team member (memberId = profile id)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; memberId: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { companyId, memberId } = await params
    const body = await request.json()
    const { name, phone, role, password } = body

    const isAdmin = await isCompanyAdmin(user.id, companyId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only team admins can update members' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { data: companyTeams } = await adminClient
      .from('client_teams')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', true)

    if (!companyTeams?.length) {
      return NextResponse.json({ error: 'Company or team not found' }, { status: 404 })
    }

    const teamIds = companyTeams.map((t) => t.id)
    const { data: membership, error: fetchError } = await adminClient
      .from('client_team_members')
      .select('team_id, role')
      .eq('member_id', memberId)
      .in('team_id', teamIds)
      .limit(1)
      .maybeSingle()

    if (fetchError || !membership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (name !== undefined || phone !== undefined) {
      const profileUpdates: Record<string, unknown> = {}
      if (name !== undefined) profileUpdates.name = name
      if (phone !== undefined) profileUpdates.phone = phone
      await adminClient
        .from('profiles')
        .update(profileUpdates)
        .eq('id', memberId)
    }

    if (password) {
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(memberId, { password })
      if (passwordError) {
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
      }
    }

    if (role !== undefined && (role === 'admin' || role === 'member')) {
      const { error: teamError } = await adminClient
        .from('client_team_members')
        .update({ role })
        .eq('team_id', membership.team_id)
        .eq('member_id', memberId)

      if (teamError) {
        return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Member updated successfully' })
  } catch (error) {
    console.error('Error updating member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a member from the client team (memberId = profile id)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; memberId: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { companyId, memberId } = await params

    if (memberId === user.id) {
      return NextResponse.json({ error: 'You cannot remove yourself from the team' }, { status: 400 })
    }

    const isAdmin = await isCompanyAdmin(user.id, companyId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only team admins can remove members' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { data: companyTeams } = await adminClient
      .from('client_teams')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', true)

    if (!companyTeams?.length) {
      return NextResponse.json({ error: 'Company or team not found' }, { status: 404 })
    }

    const teamIds = companyTeams.map((t) => t.id)
    const { data: memberships } = await adminClient
      .from('client_team_members')
      .select('team_id')
      .eq('member_id', memberId)
      .in('team_id', teamIds)

    if (!memberships?.length) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    for (const m of memberships) {
      await adminClient
        .from('client_team_members')
        .delete()
        .eq('team_id', m.team_id)
        .eq('member_id', memberId)
    }

    await adminClient
      .from('profiles')
      .update({ company_id: null, client_type: 'individual' })
      .eq('id', memberId)

    return NextResponse.json({ success: true, message: 'Member removed successfully' })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
