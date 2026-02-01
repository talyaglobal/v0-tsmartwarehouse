import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'

// POST - Create an invitation for a new team member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { companyId } = await params
    const body = await request.json()
    const { email, fullName, role } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
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
      return NextResponse.json({ error: 'Only team admins can send invitations' }, { status: 403 })
    }

    // Check if email is already a member
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      const { data: existingMember } = await supabase
        .from('client_team_members')
        .select('id')
        .eq('user_id', existingProfile.id)
        .eq('company_id', companyId)
        .maybeSingle()

      if (existingMember) {
        return NextResponse.json({ error: 'This email is already a team member' }, { status: 400 })
      }
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabase
      .from('client_team_invitations')
      .select('id')
      .eq('email', email)
      .eq('company_id', companyId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existingInvitation) {
      return NextResponse.json({ error: 'An invitation is already pending for this email' }, { status: 400 })
    }

    // Create the invitation
    const token = nanoid(32)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    const { data: invitation, error: insertError } = await supabase
      .from('client_team_invitations')
      .insert({
        company_id: companyId,
        email,
        role: role || 'member',
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating invitation:', insertError)
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
    }

    // TODO: Send invitation email
    // For now, we'll just return success
    // In production, you'd send an email with the invitation link

    return NextResponse.json({
      success: true,
      message: 'Invitation created',
      emailSent: false, // Set to true when email sending is implemented
      invitation,
    })
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - List pending invitations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { companyId } = await params

    // Verify the requesting user is a member of this company's client team
    const { data: memberCheck } = await supabase
      .from('client_team_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!memberCheck) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { data: invitations, error } = await supabase
      .from('client_team_invitations')
      .select('*')
      .eq('company_id', companyId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invitations:', error)
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
    }

    return NextResponse.json(invitations || [])
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
