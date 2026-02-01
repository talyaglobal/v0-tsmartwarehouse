import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH - Update a client team member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; memberId: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { companyId, memberId } = await params
    const body = await request.json()
    const { name, phone, role, password, canCreateBookings, canViewAllBookings, canManageTeam } = body

    // Verify the requesting user is an admin of this company's client team
    const { data: memberCheck } = await supabase
      .from('client_team_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .eq('role', 'admin')
      .maybeSingle()

    if (!memberCheck) {
      return NextResponse.json({ error: 'Only team admins can update members' }, { status: 403 })
    }

    // Get the member being updated
    const { data: targetMember, error: fetchError } = await supabase
      .from('client_team_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (fetchError || !targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const adminClient = createAdminClient()

    // Update profile if name or phone provided
    if (name !== undefined || phone !== undefined) {
      const profileUpdates: Record<string, any> = {}
      if (name !== undefined) profileUpdates.name = name
      if (phone !== undefined) profileUpdates.phone = phone

      const { error: profileError } = await adminClient
        .from('profiles')
        .update(profileUpdates)
        .eq('id', targetMember.user_id)

      if (profileError) {
        console.error('Error updating profile:', profileError)
      }
    }

    // Update password if provided
    if (password) {
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(
        targetMember.user_id,
        { password }
      )

      if (passwordError) {
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
      }
    }

    // Update team member record
    const teamUpdates: Record<string, any> = {}
    if (role !== undefined) teamUpdates.role = role
    if (canCreateBookings !== undefined) teamUpdates.can_create_bookings = canCreateBookings
    if (canViewAllBookings !== undefined) teamUpdates.can_view_all_bookings = canViewAllBookings
    if (canManageTeam !== undefined) teamUpdates.can_manage_team = canManageTeam

    if (Object.keys(teamUpdates).length > 0) {
      const { error: teamError } = await supabase
        .from('client_team_members')
        .update(teamUpdates)
        .eq('id', memberId)

      if (teamError) {
        console.error('Error updating team member:', teamError)
        return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Member updated successfully' })
  } catch (error) {
    console.error('Error updating member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a member from the client team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; memberId: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { companyId, memberId } = await params

    // Verify the requesting user is an admin of this company's client team
    const { data: memberCheck } = await supabase
      .from('client_team_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .eq('role', 'admin')
      .maybeSingle()

    if (!memberCheck) {
      return NextResponse.json({ error: 'Only team admins can remove members' }, { status: 403 })
    }

    // Get the member being removed
    const { data: targetMember } = await supabase
      .from('client_team_members')
      .select('user_id')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Prevent removing yourself
    if (targetMember.user_id === user.id) {
      return NextResponse.json({ error: 'You cannot remove yourself from the team' }, { status: 400 })
    }

    // Remove from client_team_members
    const { error: deleteError } = await supabase
      .from('client_team_members')
      .delete()
      .eq('id', memberId)

    if (deleteError) {
      console.error('Error removing member:', deleteError)
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
    }

    // Optionally, clear the company_id from their profile
    const adminClient = createAdminClient()
    await adminClient
      .from('profiles')
      .update({ company_id: null, client_type: 'individual' })
      .eq('id', targetMember.user_id)

    return NextResponse.json({ success: true, message: 'Member removed successfully' })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
