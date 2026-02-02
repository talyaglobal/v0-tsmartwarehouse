import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-middleware'
import { isCompanyAdmin } from '@/lib/auth/company-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * PATCH /api/v1/client-teams/[companyId]/[teamId]
 * Update team name/description. Caller must be team admin.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; teamId: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult

    const { companyId, teamId } = await params
    const canManage = await isCompanyAdmin(authResult.user.id, companyId)
    if (!canManage) {
      return NextResponse.json({ error: 'Only team admins can update teams' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined && typeof name === 'string' && name.trim()) updates.name = name.trim()
    if (description !== undefined) updates.description = description?.trim() || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: team, error: fetchErr } = await adminClient
      .from('client_teams')
      .select('id, name')
      .eq('id', teamId)
      .eq('company_id', companyId)
      .eq('status', true)
      .maybeSingle()

    if (fetchErr || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const { data: updated, error: updateErr } = await adminClient
      .from('client_teams')
      .update(updates)
      .eq('id', teamId)
      .select('id, name, description, is_default, created_at')
      .single()

    if (updateErr) {
      if (updateErr.code === '23505') {
        return NextResponse.json({ error: 'A team with this name already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating team:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/v1/client-teams/[companyId]/[teamId]
 * Delete team. Fails if team is default or has any admin member (must move them first).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string; teamId: string }> }
) {
  try {
    const authResult = await requireAuth(_request)
    if (authResult instanceof NextResponse) return authResult

    const { companyId, teamId } = await params
    const canManage = await isCompanyAdmin(authResult.user.id, companyId)
    if (!canManage) {
      return NextResponse.json({ error: 'Only team admins can delete teams' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { data: team, error: fetchErr } = await adminClient
      .from('client_teams')
      .select('id, is_default')
      .eq('id', teamId)
      .eq('company_id', companyId)
      .eq('status', true)
      .maybeSingle()

    if (fetchErr || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    if (team.is_default) {
      return NextResponse.json(
        { error: 'Cannot delete the default team. You can only rename it.' },
        { status: 400 }
      )
    }

    const { data: adminMembers } = await adminClient
      .from('client_team_members')
      .select('member_id')
      .eq('team_id', teamId)
      .eq('role', 'admin')

    if (adminMembers && adminMembers.length > 0) {
      return NextResponse.json(
        { error: 'This team has admin users. Move them to another team first, then delete.' },
        { status: 400 }
      )
    }

    const { error: deleteErr } = await adminClient
      .from('client_teams')
      .delete()
      .eq('id', teamId)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Team deleted' })
  } catch (error) {
    console.error('Error deleting team:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
