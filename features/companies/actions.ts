'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { getEventEmitter } from '@/lib/events/event-emitter'
import type { TeamMemberInvitedPayload } from '@/lib/events/types'
import { addEmailToQueue } from '@/lib/notifications/email/queue'
import { getEmailTemplate } from '@/lib/notifications/templates/email'

/**
 * Invite team member
 */
export async function inviteTeamMember(input: {
  companyId: string
  email: string
  role: 'owner' | 'admin' | 'member'
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify user is company admin
    const { data: member } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', input.companyId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', input.email)
      .single()

    if (existingUser) {
      // Check if already a member
      const { data: existingMember } = await supabase
        .from('company_members')
        .select('id')
        .eq('company_id', input.companyId)
        .eq('user_id', existingUser.id)
        .single()

      if (existingMember) {
        return { success: false, error: 'User is already a member' }
      }
    }

    // Generate invitation token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    // Create invitation
    const { data: invitation, error } = await supabase
      .from('company_invitations')
      .insert({
        company_id: input.companyId,
        email: input.email,
        role: input.role,
        invited_by: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Get company name
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', input.companyId)
      .single()

    // Get inviter name
    const { data: inviter } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    // Send invitation email
    const acceptUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invitation/${token}`
    const template = getEmailTemplate('team-invitation')

    if (template) {
      const html = template.html({
        invitedName: input.email.split('@')[0],
        companyName: company?.name || 'Company',
        role: input.role,
        invitedBy: inviter?.name || 'Admin',
        expiresAt: expiresAt.toLocaleDateString(),
        token,
        acceptUrl,
      })

      const subject =
        typeof template.subject === 'function'
          ? template.subject({
              companyName: company?.name || 'Company',
            })
          : template.subject

      await addEmailToQueue({
        toEmail: input.email,
        subject,
        htmlContent: html,
        priority: 5,
        metadata: {
          type: 'team_invitation',
          invitationId: invitation.id,
        },
      })
    }

    // Emit team member invited event
    const emitter = getEventEmitter()
    await emitter.emit({
      eventType: 'team.member.invited',
      entityType: 'invitation',
      entityId: invitation.id,
      invitationId: invitation.id,
      companyId: input.companyId,
      invitedEmail: input.email,
      invitedBy: user.id,
      role: input.role,
      expiresAt: expiresAt.toISOString(),
      timestamp: new Date().toISOString(),
    } as TeamMemberInvitedPayload)

    revalidatePath('/dashboard/team')
    return { success: true, data: invitation }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Accept invitation
 */
export async function acceptInvitation(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get invitation
    const { data: invitation } = await supabase
      .from('company_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (!invitation) {
      return { success: false, error: 'Invitation not found' }
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return { success: false, error: 'Invitation has expired' }
    }

    // Check if already accepted
    if (invitation.accepted_at) {
      return { success: false, error: 'Invitation already accepted' }
    }

    // Verify email matches
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    if (profile?.email !== invitation.email) {
      return {
        success: false,
        error: 'Invitation email does not match your account',
      }
    }

    // Create company member
    const { error: memberError } = await supabase
      .from('company_members')
      .insert({
        company_id: invitation.company_id,
        user_id: user.id,
        role: invitation.role,
        invited_by: invitation.invited_by,
        invited_at: invitation.created_at,
        joined_at: new Date().toISOString(),
        status: 'active',
      })

    if (memberError) {
      return { success: false, error: memberError.message }
    }

    // Update invitation
    await supabase
      .from('company_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    // Update user's company_id in profile
    await supabase
      .from('profiles')
      .update({ company_id: invitation.company_id })
      .eq('id', user.id)

    // Emit team member joined event
    const emitter = getEventEmitter()
    await emitter.emit({
      eventType: 'team.member.joined',
      entityType: 'team_member',
      entityId: user.id,
      memberId: user.id,
      companyId: invitation.company_id,
      userId: user.id,
      role: invitation.role,
      timestamp: new Date().toISOString(),
    })

    revalidatePath('/dashboard/team')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Remove team member
 */
export async function removeTeamMember(
  companyId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Verify user is company admin
    const { data: member } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    // Cannot remove yourself
    if (userId === user.id) {
      return { success: false, error: 'Cannot remove yourself' }
    }

    // Deactivate member
    const { error } = await supabase
      .from('company_members')
      .update({ status: 'inactive' })
      .eq('company_id', companyId)
      .eq('user_id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/team')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

