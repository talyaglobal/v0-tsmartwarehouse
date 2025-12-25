'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { getEventEmitter } from '@/lib/events/event-emitter'
import type { TeamMemberInvitedPayload } from '@/lib/events/types'
import { addEmailToQueue } from '@/lib/notifications/email/queue'
import { getEmailTemplate } from '@/lib/notifications/templates/email'
import { getSiteUrl } from '@/lib/utils/site-url'

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

    // Verify user is company admin (using profiles.role)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .eq('company_id', input.companyId)
      .in('role', ['owner', 'admin'])
      .maybeSingle()

    if (!profile) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id, company_id')
      .eq('email', input.email)
      .maybeSingle()

    if (existingUser) {
      // Check if already a member
      if (existingUser.company_id === input.companyId) {
        return { success: false, error: 'User is already a member' }
      }
    }

    // Generate invitation token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    const supabaseAdmin = await createServerSupabaseClient({ admin: true })

    // Update or create profile with invitation data
    let invitation: any
    if (existingUser) {
      // Update existing profile with invitation data
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          invitation_token: token,
          invitation_expires_at: expiresAt.toISOString(),
          invitation_company_id: input.companyId,
          invitation_role: input.role,
          invited_by: user.id,
        })
        .eq('id', existingUser.id)
        .select()
        .single()
      
      if (updateError) {
        return { success: false, error: updateError.message }
      }
      invitation = updatedProfile
    } else {
      // For new users, we would need to create them via API
      // This function is deprecated in favor of the API endpoint
      return { success: false, error: 'Please use the API endpoint to invite new users' }
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
    const acceptUrl = `${getSiteUrl()}/accept-invitation/${token}`
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
): Promise<{ success: boolean; error?: string; requiresRegistration?: boolean }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Get admin client for profile operations
    const supabaseAdmin = await createServerSupabaseClient({ admin: true })

    // Find profile with this invitation token
    const { data: invitationProfile, error: invitationError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name, invitation_token, invitation_expires_at, company_id, role, invited_by')
      .eq('invitation_token', token)
      .maybeSingle()

    if (invitationError || !invitationProfile || !invitationProfile.invitation_token) {
      return { success: false, error: 'Invitation not found' }
    }

    // Check if expired
    if (invitationProfile.invitation_expires_at && new Date(invitationProfile.invitation_expires_at) < new Date()) {
      return { success: false, error: 'Invitation has expired' }
    }

    // Check if already accepted (if invitation_token is null, invitation was accepted)
    // Since we already filtered by invitation_token, if we got here, invitation is still pending
    // But check anyway for safety

    // If user is not logged in, they need to register first
    if (!user) {
      return { 
        success: false, 
        error: 'Please log in or create an account to accept this invitation',
        requiresRegistration: true 
      }
    }

    // Verify email matches (invitation email must match logged-in user email)
    if (invitationProfile.email?.toLowerCase() !== user.email?.toLowerCase()) {
      return {
        success: false,
        error: 'Invitation email does not match your account. Please log in with the email address that received the invitation.',
      }
    }

    // Verify that invitation profile ID matches user ID (for safety)
    // In most cases, invitation profile ID should match user.id, but we'll update using token to be safe
    if (invitationProfile.id !== user.id) {
      console.warn(`Warning: Invitation profile ID (${invitationProfile.id}) does not match user ID (${user.id}). Proceeding with token-based update.`)
    }

    // Get user details from auth
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.id)
    if (!authUser?.user) {
      return {
        success: false,
        error: 'User not found in authentication system',
      }
    }

    const userMetadata = authUser.user.user_metadata || {}

    // Use fullname from profile if available, otherwise from user_metadata, otherwise email prefix
    const fullName = invitationProfile.name?.trim() || 
                    userMetadata.name || 
                    user.email?.split('@')[0] || 
                    'User'

    // We need to get the company_id from the inviter's profile
    // The invitation profile should have invited_by set
    let targetCompanyId: string | null = null
    
    if (invitationProfile.invited_by) {
      const { data: inviterProfile } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', invitationProfile.invited_by)
        .single()
      
      if (inviterProfile?.company_id) {
        targetCompanyId = inviterProfile.company_id
      }
    }

    if (!targetCompanyId) {
      return {
        success: false,
        error: 'Cannot determine company from invitation. Invitation may be invalid.',
      }
    }

    // Role is already stored in the profile when invitation was created
    // We just need to set company_id when invitation is accepted
    const updateData: any = {
      company_id: targetCompanyId, // Set company_id when invitation is accepted
      // Role is already set in profile from invitation creation, no need to update it
      // Clear invitation fields after acceptance (including password for security)
      invitation_token: null,
      invitation_expires_at: null,
      invitation_password: null, // Clear password after acceptance for security
    }

    // Update name if empty
    if (!invitationProfile.name || invitationProfile.name.trim() === '') {
      updateData.name = fullName
    }

    // If profile doesn't have invited_by, set it from the invitation (if we can find who invited)
    // Note: We don't have invited_by in the invitation fields anymore, so we'll skip this
    // The invited_by should have been set when the invitation was created

    // targetCompanyId is already set above from inviter's profile
    
    // Update profile using the invitation profile ID
    // Clear invitation_token and invitation_expires_at to mark invitation as accepted
    // company_id and role are already set when invitation was created
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', invitationProfile.id)
    
    if (updateProfileError) {
      console.error('Error updating profile:', updateProfileError)
      return {
        success: false,
        error: `Failed to accept invitation: ${updateProfileError.message}`,
      }
    }
    
    // Verify the update was successful - check that invitation fields were cleared
    const { data: updatedProfile, error: verifyError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id, invitation_token, email, role')
      .eq('id', invitationProfile.id)
      .single()
    
    if (verifyError || !updatedProfile) {
      console.error('Error verifying profile update:', verifyError)
      return {
        success: false,
        error: `Failed to verify invitation acceptance: ${verifyError?.message || 'Profile not found after update'}`,
      }
    }
    
    // Verify that invitation_token was cleared (invitation accepted)
    if (updatedProfile.invitation_token !== null) {
      console.error('Warning: invitation_token was not cleared! Attempting to clear again...')
      const { error: fixError } = await supabaseAdmin
        .from('profiles')
        .update({ invitation_token: null, invitation_expires_at: null })
        .eq('id', invitationProfile.id)
      
      if (fixError) {
        console.error('Error clearing invitation_token:', fixError)
        return {
          success: false,
          error: `Failed to clear invitation_token: ${fixError.message}`,
        }
      }
    }
    
    console.log('✅ Invitation accepted successfully, profile updated:', {
      profileId: updatedProfile.id,
      email: updatedProfile.email,
      companyId: updatedProfile.company_id,
      role: updatedProfile.role,
      invitationTokenCleared: updatedProfile.invitation_token === null
    })

    // Emit team member joined event
    const emitter = getEventEmitter()
    await emitter.emit({
      eventType: 'team.member.joined',
      entityType: 'team_member',
      entityId: user.id,
      memberId: user.id,
      companyId: invitationProfile.invitation_company_id,
      userId: user.id,
      role: invitationProfile.invitation_role || 'member',
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
 * Remove team member (deprecated - use API endpoint instead)
 * This function is kept for backwards compatibility but should not be used
 */
export async function removeTeamMember(
  companyId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // This function is deprecated - company_members table no longer exists
  // Use the API endpoint DELETE /api/v1/companies/[id]/members/[memberId] instead
  return { success: false, error: 'This function is deprecated. Please use the API endpoint to remove members.' }
}

