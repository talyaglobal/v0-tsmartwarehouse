import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST - Add a new member directly to the client team
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { companyId } = await params
    const body = await request.json()
    const { email, fullName, role, password } = body

    if (!email || !fullName || !password) {
      return NextResponse.json({ error: 'Email, full name, and password are required' }, { status: 400 })
    }

    // Verify the requesting user is an admin of this company's client team
    const { data: memberCheck } = await supabase
      .from('client_team_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .eq('role', 'admin')
      .maybeSingle()

    if (!memberCheck) {
      return NextResponse.json({ error: 'Only team admins can add members' }, { status: 403 })
    }

    // Create the user using admin client
    const adminClient = createAdminClient()
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: fullName,
      },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // Update the profile with company_id and client_type
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        company_id: companyId,
        client_type: 'corporate',
        role: 'warehouse_client',
        name: fullName,
      })
      .eq('id', newUser.user.id)

    if (profileError) {
      console.error('Error updating profile:', profileError)
    }

    // Add to client_team_members
    const { error: teamError } = await adminClient
      .from('client_team_members')
      .insert({
        user_id: newUser.user.id,
        company_id: companyId,
        role: role || 'member',
        can_create_bookings: true,
        can_view_all_bookings: role === 'admin',
        can_manage_team: role === 'admin',
        invited_by: user.id,
        joined_at: new Date().toISOString(),
      })

    if (teamError) {
      console.error('Error adding to team:', teamError)
      return NextResponse.json({ error: 'Failed to add member to team' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Member added successfully',
      userId: newUser.user.id,
    })
  } catch (error) {
    console.error('Error adding member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
