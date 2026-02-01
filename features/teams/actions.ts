"use server"

import {
  createTeamWithValidation,
  updateTeamWithValidation,
  deleteTeamWithValidation,
  addMemberWithValidation,
  removeMemberWithValidation,
  updateMemberRoleWithValidation,
  getTeamDetails,
  getUserTeams,
  getTeamMembersForBooking,
} from "@/lib/business-logic/teams"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ClientTeam, TeamMember, TeamRole } from "@/types"

// =====================================================
// Team Actions
// =====================================================

export async function createTeamAction(
  name: string,
  description?: string
): Promise<{ success: boolean; data?: ClientTeam; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    // Get user's company ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!profile?.company_id) {
      return { success: false, error: "No company associated with your account" }
    }

    const result = await createTeamWithValidation({
      name,
      description,
      companyId: profile.company_id,
      createdBy: user.id,
    })

    return { success: true, data: result.team }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to create team" 
    }
  }
}

export async function updateTeamAction(
  teamId: string,
  updates: { name?: string; description?: string }
): Promise<{ success: boolean; data?: ClientTeam; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const team = await updateTeamWithValidation(teamId, user.id, updates)
    return { success: true, data: team }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update team" 
    }
  }
}

export async function deleteTeamAction(
  teamId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    await deleteTeamWithValidation(teamId, user.id)
    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to delete team" 
    }
  }
}

// =====================================================
// Member Actions
// =====================================================

export async function addTeamMemberAction(
  teamId: string,
  memberId: string,
  role: TeamRole = "member"
): Promise<{ success: boolean; data?: TeamMember; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const result = await addMemberWithValidation({
      teamId,
      memberId,
      role,
      invitedBy: user.id,
    })

    return { success: true, data: result.member }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to add member" 
    }
  }
}

export async function removeTeamMemberAction(
  teamId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    await removeMemberWithValidation(teamId, memberId, user.id)
    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to remove member" 
    }
  }
}

export async function updateMemberRoleAction(
  teamId: string,
  memberId: string,
  role: TeamRole
): Promise<{ success: boolean; data?: TeamMember; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const member = await updateMemberRoleWithValidation(teamId, memberId, role, user.id)
    return { success: true, data: member }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to update member role" 
    }
  }
}

// =====================================================
// Query Actions
// =====================================================

export async function getMyTeamsAction(): Promise<{ 
  success: boolean; 
  data?: ClientTeam[]; 
  error?: string 
}> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const teams = await getUserTeams(user.id)
    return { success: true, data: teams }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get teams" 
    }
  }
}

export async function getTeamDetailsAction(
  teamId: string
): Promise<{ success: boolean; data?: ClientTeam; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const team = await getTeamDetails(teamId, user.id)
    return { success: true, data: team }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get team details" 
    }
  }
}

export async function getBookingMembersAction(): Promise<{
  success: boolean
  data?: Array<TeamMember & { teamId: string; teamName: string }>
  error?: string
}> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    const members = await getTeamMembersForBooking(user.id)
    return { success: true, data: members }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get booking members" 
    }
  }
}
