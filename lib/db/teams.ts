/**
 * Database operations for Client Teams
 * Handles team CRUD operations and team membership management
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ClientTeam, TeamMember, TeamRole } from '@/types'

// =====================================================
// Team CRUD Operations
// =====================================================

interface GetTeamsOptions {
  companyId?: string
  status?: boolean
  limit?: number
  offset?: number
}

/**
 * Get teams with optional filters
 */
export async function getTeams(filters?: GetTeamsOptions): Promise<ClientTeam[]> {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('client_teams')
    .select(`
      *,
      companies:company_id (short_name),
      member_count:client_team_members(count)
    `)

  if (filters?.companyId) {
    query = query.eq('company_id', filters.companyId)
  }

  if (filters?.status !== undefined) {
    query = query.eq('status', filters.status)
  }

  if (filters?.limit) {
    query = query.range(
      filters.offset || 0,
      (filters.offset || 0) + filters.limit - 1
    )
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`)
  }

  return (data || []).map(transformTeamRow)
}

/**
 * Get teams by company ID
 */
export async function getTeamsByCompany(companyId: string): Promise<ClientTeam[]> {
  return getTeams({ companyId, status: true })
}

/**
 * Get team by ID
 */
export async function getTeamById(teamId: string): Promise<ClientTeam | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('client_teams')
    .select(`
      *,
      companies:company_id (short_name),
      members:client_team_members (
        member_id,
        role,
        joined_at,
        invited_by,
        profiles:member_id (id, name, email, avatar, client_type)
      )
    `)
    .eq('id', teamId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch team: ${error.message}`)
  }

  return transformTeamRowWithMembers(data)
}

/**
 * Create a new team
 */
export async function createTeam(
  team: {
    companyId: string
    name: string
    description?: string
    createdBy: string
  }
): Promise<ClientTeam> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('client_teams')
    .insert({
      company_id: team.companyId,
      name: team.name,
      description: team.description,
      created_by: team.createdBy,
      status: true,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create team: ${error.message}`)
  }

  // Add the creator as the first admin
  await addTeamMember(data.id, team.createdBy, 'admin', team.createdBy)

  return transformTeamRow(data)
}

/**
 * Update team
 */
export async function updateTeam(
  teamId: string,
  updates: Partial<{
    name: string
    description: string
    status: boolean
  }>
): Promise<ClientTeam> {
  const supabase = await createServerSupabaseClient()

  const updateData: Record<string, unknown> = {}
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.status !== undefined) updateData.status = updates.status

  const { data, error } = await supabase
    .from('client_teams')
    .update(updateData)
    .eq('id', teamId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update team: ${error.message}`)
  }

  return transformTeamRow(data)
}

/**
 * Soft delete team (set status to false)
 */
export async function deleteTeam(teamId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('client_teams')
    .update({ status: false })
    .eq('id', teamId)

  if (error) {
    throw new Error(`Failed to delete team: ${error.message}`)
  }
}

// =====================================================
// Team Membership Operations
// =====================================================

/**
 * Get team members
 */
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('client_team_members')
    .select(`
      team_id,
      member_id,
      role,
      joined_at,
      invited_by,
      profiles:member_id (id, name, email, avatar, client_type)
    `)
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch team members: ${error.message}`)
  }

  return (data || []).map(transformTeamMemberRow)
}

/**
 * Add a member to a team
 */
export async function addTeamMember(
  teamId: string,
  memberId: string,
  role: TeamRole = 'member',
  invitedBy?: string
): Promise<TeamMember> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('client_team_members')
    .insert({
      team_id: teamId,
      member_id: memberId,
      role,
      invited_by: invitedBy,
    })
    .select(`
      team_id,
      member_id,
      role,
      joined_at,
      invited_by,
      profiles:member_id (id, name, email, avatar, client_type)
    `)
    .single()

  if (error) {
    throw new Error(`Failed to add team member: ${error.message}`)
  }

  return transformTeamMemberRow(data)
}

/**
 * Remove a member from a team
 */
export async function removeTeamMember(teamId: string, memberId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('client_team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('member_id', memberId)

  if (error) {
    throw new Error(`Failed to remove team member: ${error.message}`)
  }
}

/**
 * Update member role
 */
export async function updateMemberRole(
  teamId: string,
  memberId: string,
  role: TeamRole
): Promise<TeamMember> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('client_team_members')
    .update({ role })
    .eq('team_id', teamId)
    .eq('member_id', memberId)
    .select(`
      team_id,
      member_id,
      role,
      joined_at,
      invited_by,
      profiles:member_id (id, name, email, avatar, client_type)
    `)
    .single()

  if (error) {
    throw new Error(`Failed to update member role: ${error.message}`)
  }

  return transformTeamMemberRow(data)
}

// =====================================================
// Team Permission Helpers
// =====================================================

/**
 * Check if user is a team admin
 */
export async function isTeamAdmin(teamId: string, userId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('client_team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('member_id', userId)
    .single()

  if (error || !data) {
    return false
  }

  return data.role === 'admin'
}

/**
 * Check if user is a member of a team
 */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('client_team_members')
    .select('member_id')
    .eq('team_id', teamId)
    .eq('member_id', userId)
    .single()

  return !error && !!data
}

/**
 * Get user's teams
 */
export async function getUserTeams(userId: string): Promise<ClientTeam[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('client_team_members')
    .select(`
      role,
      client_teams:team_id (
        id,
        company_id,
        name,
        description,
        created_by,
        status,
        created_at,
        updated_at,
        companies:company_id (short_name)
      )
    `)
    .eq('member_id', userId)

  if (error) {
    throw new Error(`Failed to fetch user teams: ${error.message}`)
  }

  return (data || [])
    .filter((row: any) => row.client_teams?.status === true)
    .map((row: any) => ({
      ...transformTeamRow(row.client_teams),
      userRole: row.role,
    }))
}

/**
 * Get team members that user can book on behalf of
 * Uses: 1) teams where user is in client_team_members, or 2) if none, teams for user's company_id (so company admins see members).
 */
export async function getTeamMembersForBooking(userId: string): Promise<Array<TeamMember & { teamId: string; teamName: string }>> {
  const supabase = await createServerSupabaseClient()

  let teamIds: string[] = []

  const { data: userTeams, error: teamError } = await supabase
    .from('client_team_members')
    .select('team_id')
    .eq('member_id', userId)

  if (!teamError && userTeams && userTeams.length > 0) {
    teamIds = userTeams.map((t: any) => t.team_id)
  } else {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single()
    const companyId = profile?.company_id
    if (companyId) {
      const companyTeams = await getTeamsByCompany(companyId)
      teamIds = companyTeams.map((t) => t.id)
    }
  }

  if (teamIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('client_team_members')
    .select(`
      team_id,
      member_id,
      role,
      joined_at,
      client_teams:team_id (name),
      profiles:member_id (id, name, email, avatar, client_type)
    `)
    .in('team_id', teamIds)
    .neq('member_id', userId)

  if (error) {
    throw new Error(`Failed to fetch team members for booking: ${error.message}`)
  }

  return (data || []).map((row: any) => ({
    ...transformTeamMemberRow(row),
    teamId: row.team_id,
    teamName: row.client_teams?.name || '',
  }))
}

/**
 * Check if user can book on behalf of another user (same team)
 */
export async function canBookOnBehalf(bookerId: string, customerId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.rpc('can_book_on_behalf', {
    p_booker_id: bookerId,
    p_customer_id: customerId,
  })

  if (error) {
    console.error('Error checking booking permission:', error)
    return false
  }

  return data === true
}

/**
 * Check if booker is a team admin for a team that contains the customer.
 * Only team admins can create pre-approved (no approval required) on-behalf bookings.
 */
export async function isTeamAdminForBooking(bookerId: string, customerId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  const { data: adminTeams } = await supabase
    .from('client_team_members')
    .select('team_id')
    .eq('member_id', bookerId)
    .eq('role', 'admin')

  if (!adminTeams?.length) return false

  const teamIds = adminTeams.map((t: any) => t.team_id)
  const { data: customerInTeam } = await supabase
    .from('client_team_members')
    .select('team_id')
    .eq('member_id', customerId)
    .in('team_id', teamIds)
    .limit(1)
    .maybeSingle()

  return !!customerInTeam
}

// =====================================================
// Transform Functions
// =====================================================

function transformTeamRow(row: any): ClientTeam {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    status: row.status,
    memberCount: row.member_count?.[0]?.count || 0,
    companyName: row.companies?.short_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function transformTeamRowWithMembers(row: any): ClientTeam {
  const team = transformTeamRow(row)
  
  if (row.members) {
    team.members = row.members.map((m: any) => ({
      teamId: m.member_id ? row.id : m.team_id,
      memberId: m.member_id,
      role: m.role,
      joinedAt: m.joined_at,
      invitedBy: m.invited_by,
      name: m.profiles?.name,
      email: m.profiles?.email,
      avatar: m.profiles?.avatar,
      clientType: m.profiles?.client_type,
    }))
    team.memberCount = team.members?.length || 0
  }

  return team
}

function transformTeamMemberRow(row: any): TeamMember {
  return {
    teamId: row.team_id,
    memberId: row.member_id,
    role: row.role,
    joinedAt: row.joined_at,
    invitedBy: row.invited_by,
    name: row.profiles?.name,
    email: row.profiles?.email,
    avatar: row.profiles?.avatar,
    clientType: row.profiles?.client_type,
  }
}
