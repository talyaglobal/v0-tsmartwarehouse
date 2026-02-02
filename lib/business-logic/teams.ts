/**
 * Business Logic: Team Management
 * 
 * Handles:
 * - Team creation and management
 * - Team membership operations
 * - Permission validation
 * - Corporate client team workflows
 */

import {
  getTeamsByCompany,
  getTeamById,
  createTeam as dbCreateTeam,
  updateTeam as dbUpdateTeam,
  deleteTeam as dbDeleteTeam,
  addTeamMember as dbAddTeamMember,
  removeTeamMember as dbRemoveTeamMember,
  updateMemberRole as dbUpdateMemberRole,
  isTeamAdmin,
  isTeamMember,
  getUserTeams,
  getTeamMembersForBooking,
  canBookOnBehalf,
} from '@/lib/db/teams'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ClientTeam, TeamMember, TeamRole } from '@/types'

// =====================================================
// Team Management
// =====================================================

export interface CreateTeamInput {
  name: string
  description?: string
  companyId: string
  createdBy: string
}

export interface CreateTeamResult {
  team: ClientTeam
  message: string
}

/**
 * Create a new team with validation
 */
export async function createTeamWithValidation(
  input: CreateTeamInput
): Promise<CreateTeamResult> {
  // Validate user is part of the company and is corporate type
  const supabase = await createServerSupabaseClient()
  
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id, client_type')
    .eq('id', input.createdBy)
    .single()

  if (profileError || !profile) {
    throw new Error('User profile not found')
  }

  if (profile.client_type !== 'corporate') {
    throw new Error('Only corporate clients can create teams')
  }

  if (profile.company_id !== input.companyId) {
    throw new Error('You can only create teams for your own company')
  }

  const existingTeams = await getTeamsByCompany(input.companyId)

  // Only team admins can create new teams (or first team for company)
  if (existingTeams.length > 0) {
    let userIsAdmin = false
    for (const t of existingTeams) {
      if (await isTeamAdmin(t.id, input.createdBy)) {
        userIsAdmin = true
        break
      }
    }
    if (!userIsAdmin) {
      throw new Error('Only team admins can create new teams')
    }
  }

  if (existingTeams.some(t => t.name.toLowerCase() === input.name.toLowerCase())) {
    throw new Error('A team with this name already exists in your company')
  }

  // Create the team
  const team = await dbCreateTeam({
    companyId: input.companyId,
    name: input.name,
    description: input.description,
    createdBy: input.createdBy,
  })

  return {
    team,
    message: 'Team created successfully. You have been added as the team admin.',
  }
}

/**
 * Update a team with permission validation
 */
export async function updateTeamWithValidation(
  teamId: string,
  userId: string,
  updates: { name?: string; description?: string }
): Promise<ClientTeam> {
  // Check if user is a team admin
  const isAdmin = await isTeamAdmin(teamId, userId)
  if (!isAdmin) {
    throw new Error('Only team admins can update team details')
  }

  // If updating name, check for duplicates
  if (updates.name) {
    const team = await getTeamById(teamId)
    if (!team) {
      throw new Error('Team not found')
    }

    const existingTeams = await getTeamsByCompany(team.companyId)
    if (existingTeams.some(t => 
      t.id !== teamId && t.name.toLowerCase() === updates.name!.toLowerCase()
    )) {
      throw new Error('A team with this name already exists in your company')
    }
  }

  return await dbUpdateTeam(teamId, updates)
}

/**
 * Delete (soft) a team with permission validation
 */
export async function deleteTeamWithValidation(
  teamId: string,
  userId: string
): Promise<void> {
  // Check if user is a team admin
  const isAdmin = await isTeamAdmin(teamId, userId)
  if (!isAdmin) {
    throw new Error('Only team admins can delete a team')
  }

  await dbDeleteTeam(teamId)
}

// =====================================================
// Team Membership Management
// =====================================================

export interface AddMemberInput {
  teamId: string
  memberId: string
  role: TeamRole
  invitedBy: string
}

export interface AddMemberResult {
  member: TeamMember
  message: string
}

/**
 * Add a member to a team with validation
 */
export async function addMemberWithValidation(
  input: AddMemberInput
): Promise<AddMemberResult> {
  // Check if inviter is a team admin
  const isAdmin = await isTeamAdmin(input.teamId, input.invitedBy)
  if (!isAdmin) {
    throw new Error('Only team admins can add members')
  }

  // Get team to check company
  const team = await getTeamById(input.teamId)
  if (!team) {
    throw new Error('Team not found')
  }

  // Check if new member is in the same company
  const supabase = await createServerSupabaseClient()
  const { data: memberProfile, error: memberError } = await supabase
    .from('profiles')
    .select('company_id, client_type, name, email')
    .eq('id', input.memberId)
    .single()

  if (memberError || !memberProfile) {
    throw new Error('User not found')
  }

  if (memberProfile.company_id !== team.companyId) {
    throw new Error('You can only add members from your own company')
  }

  // Check if user is already a member
  const isMember = await isTeamMember(input.teamId, input.memberId)
  if (isMember) {
    throw new Error('User is already a member of this team')
  }

  // Update member to corporate type if not already
  if (memberProfile.client_type !== 'corporate') {
    await supabase
      .from('profiles')
      .update({ client_type: 'corporate' })
      .eq('id', input.memberId)
  }

  const member = await dbAddTeamMember(
    input.teamId,
    input.memberId,
    input.role,
    input.invitedBy
  )

  return {
    member,
    message: `${memberProfile.name || memberProfile.email} has been added to the team as ${input.role}.`,
  }
}

/**
 * Remove a member from a team with validation
 */
export async function removeMemberWithValidation(
  teamId: string,
  memberId: string,
  removedBy: string
): Promise<void> {
  // User can remove themselves, or admin can remove anyone
  if (memberId !== removedBy) {
    const isAdmin = await isTeamAdmin(teamId, removedBy)
    if (!isAdmin) {
      throw new Error('Only team admins can remove other members')
    }
  }

  // Check if member is the last admin
  const team = await getTeamById(teamId)
  if (!team || !team.members) {
    throw new Error('Team not found')
  }

  const admins = team.members.filter(m => m.role === 'admin')
  const isLastAdmin = admins.length === 1 && admins[0].memberId === memberId

  if (isLastAdmin) {
    throw new Error('Cannot remove the last admin. Transfer admin rights first or delete the team.')
  }

  await dbRemoveTeamMember(teamId, memberId)
}

/**
 * Update member role with validation
 */
export async function updateMemberRoleWithValidation(
  teamId: string,
  memberId: string,
  newRole: TeamRole,
  updatedBy: string
): Promise<TeamMember> {
  // Only admin can change roles
  const isAdmin = await isTeamAdmin(teamId, updatedBy)
  if (!isAdmin) {
    throw new Error('Only team admins can change member roles')
  }

  // Cannot demote yourself if you're the last admin
  if (memberId === updatedBy && newRole === 'member') {
    const team = await getTeamById(teamId)
    if (!team || !team.members) {
      throw new Error('Team not found')
    }

    const admins = team.members.filter(m => m.role === 'admin')
    if (admins.length === 1) {
      throw new Error('Cannot demote yourself when you are the only admin')
    }
  }

  return await dbUpdateMemberRole(teamId, memberId, newRole)
}

// =====================================================
// Team Query Functions (re-export with additional logic)
// =====================================================

/**
 * Get teams for a company (with permission check)
 */
export async function getCompanyTeams(
  companyId: string,
  userId: string
): Promise<ClientTeam[]> {
  // Verify user is part of the company
  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single()

  if (!profile || profile.company_id !== companyId) {
    throw new Error('You can only view teams in your own company')
  }

  return await getTeamsByCompany(companyId)
}

/**
 * Get team details with permission check
 */
export async function getTeamDetails(
  teamId: string,
  userId: string
): Promise<ClientTeam> {
  const team = await getTeamById(teamId)
  if (!team) {
    throw new Error('Team not found')
  }

  // Check if user is a member
  const isMember = await isTeamMember(teamId, userId)
  if (!isMember) {
    // Check if user is root (can view all)
    const supabase = await createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (!profile || profile.role !== 'root') {
      throw new Error('You do not have permission to view this team')
    }
  }

  return team
}

// Re-export useful functions from db layer
export {
  getUserTeams,
  getTeamMembersForBooking,
  canBookOnBehalf,
  isTeamAdmin,
  isTeamMember,
}
