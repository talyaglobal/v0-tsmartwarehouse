import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api-middleware'
import { isCompanyAdmin, getUserCompanyId } from '@/lib/auth/company-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { nanoid } from 'nanoid'

// POST - Create an invitation for a new team member
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
    const { email, role } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const isAdmin = await isCompanyAdmin(user.id, companyId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only team admins can send invitations' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      const { data: companyTeams } = await adminClient
        .from('client_teams')
        .select('id')
        .eq('company_id', companyId)
        .eq('status', true)
      const teamIds = companyTeams?.map((t) => t.id) ?? []
      if (teamIds.length > 0) {
        const { data: existingMember } = await adminClient
          .from('client_team_members')
          .select('team_id')
          .eq('member_id', existingProfile.id)
          .in('team_id', teamIds)
          .limit(1)
          .maybeSingle()
        if (existingMember) {
          return NextResponse.json({ error: 'This email is already a team member' }, { status: 400 })
        }
      }
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    const token = nanoid(32)

    const { data: invitation, error: insertError } = await adminClient
      .from('client_team_invitations')
      .insert({
        company_id: companyId,
        email,
        role: role === 'admin' ? 'admin' : 'member',
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

    return NextResponse.json({
      success: true,
      message: 'Invitation created',
      emailSent: false,
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
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { companyId } = await params

    const userCompanyId = await getUserCompanyId(user.id)
    if (userCompanyId !== companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const adminClient = createAdminClient()
    const { data: invitations, error } = await adminClient
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
