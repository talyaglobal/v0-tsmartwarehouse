import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Check if user is a company admin:
 * - Platform admin: admin, super_admin, root (profiles.role) with matching company_id
 * - Warehouse side: warehouse_owner, warehouse_admin, warehouse_supervisor (profiles.role)
 * - Corporate client side: warehouse_client with client_team_members.role = 'admin' for a team of this company
 */
export async function isCompanyAdmin(userId: string, companyId?: string): Promise<boolean> {
  const supabase = createServerSupabaseClient()

  // 0) Platform admin (admin/super_admin/root) with matching company – can update their company
  if (companyId) {
    const { data: platformProfile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', userId)
      .eq('company_id', companyId)
      .in('role', ['admin', 'super_admin', 'root'])
      .maybeSingle()
    if (platformProfile) return true
  }

  // 1) Warehouse admin/owner/supervisor for this company (include legacy: owner, company_admin)
  let query = supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', userId)
    .in('role', ['warehouse_owner', 'warehouse_admin', 'warehouse_supervisor', 'owner', 'company_admin'])

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data: profile, error: profileError } = await query.maybeSingle()

  if (!profileError && profile) {
    return true
  }

  // 2) Corporate client: team admin for this company (client_team_members.role = 'admin' on a team with company_id)
  if (companyId) {
    const { data: companyTeams, error: teamsError } = await supabase
      .from('client_teams')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', true)

    if (!teamsError && companyTeams && companyTeams.length > 0) {
      const teamIds = companyTeams.map((t) => t.id)
      const { data: adminMembership, error: memberError } = await supabase
        .from('client_team_members')
        .select('team_id')
        .eq('member_id', userId)
        .eq('role', 'admin')
        .in('team_id', teamIds)
        .limit(1)
        .maybeSingle()

      if (!memberError && adminMembership) return true
    }
  }

  // 3) Fallback: user has this company_id and role is any known admin-like value (covers legacy/alternate DB values)
  if (companyId) {
    const ADMIN_LIKE_ROLES = [
      'admin', 'super_admin', 'root',
      'warehouse_owner', 'warehouse_admin', 'warehouse_supervisor',
      'owner', 'company_admin',
    ]
    const { data: fallbackProfile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', userId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (fallbackProfile && fallbackProfile.role && ADMIN_LIKE_ROLES.includes(fallbackProfile.role)) {
      return true
    }
  }

  return false
}

/**
 * Get user's company ID
 */
export async function getUserCompanyId(userId: string): Promise<string | null> {
  const supabase = createServerSupabaseClient()
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single()
  
  if (error || !profile) {
    return null
  }
  
  return profile.company_id
}

/**
 * Get user's company member role (using profiles.role)
 * Maps new role names to old format for backward compatibility
 */
export async function getUserCompanyRole(userId: string, companyId: string): Promise<'warehouse_admin' | 'warehouse_supervisor' | 'warehouse_staff' | null> {
  const supabase = createServerSupabaseClient()
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', userId)
    .eq('company_id', companyId)
    .maybeSingle()
  
  if (error || !profile) {
    return null
  }
  
  // Map profile role to company role (new role names)
  if (profile.role === 'warehouse_admin') return 'warehouse_admin'
  if (profile.role === 'warehouse_supervisor') return 'warehouse_supervisor'
  if (profile.role === 'warehouse_staff') return 'warehouse_staff'
  return null
}

/**
 * Get all company IDs where user is admin or owner:
 * - Warehouse side: profiles.role in warehouse_owner/admin/supervisor
 * - Corporate client side: client_team_members.role = 'admin' for a team of that company
 */
export async function getUserAdminCompanies(userId: string): Promise<string[]> {
  const supabase = createServerSupabaseClient()
  const companyIds = new Set<string>()

  // 1) Warehouse admin companies (include legacy: owner, company_admin)
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .in('role', ['warehouse_owner', 'warehouse_admin', 'warehouse_supervisor', 'owner', 'company_admin'])
    .not('company_id', 'is', null)

  if (!error && profiles) {
    profiles.forEach((p) => p.company_id && companyIds.add(p.company_id))
  }

  // 2) Corporate client: companies where user is team admin
  const { data: adminMemberships } = await supabase
    .from('client_team_members')
    .select('team_id')
    .eq('member_id', userId)
    .eq('role', 'admin')

  if (adminMemberships && adminMemberships.length > 0) {
    const teamIds = adminMemberships.map((m) => m.team_id)
    const { data: teams } = await supabase
      .from('client_teams')
      .select('company_id')
      .in('id', teamIds)
      .eq('status', true)
    if (teams) teams.forEach((t) => t.company_id && companyIds.add(t.company_id))
  }

  return Array.from(companyIds)
}

