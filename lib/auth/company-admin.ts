import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Check if user is a warehouse admin or warehouse owner (using profiles.role)
 * Supports both old and new role names for backward compatibility
 */
export async function isCompanyAdmin(userId: string, companyId?: string): Promise<boolean> {
  const supabase = createServerSupabaseClient()
  
  let query = supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', userId)
    .in('role', ['warehouse_owner', 'warehouse_admin', 'warehouse_supervisor'])
  
  if (companyId) {
    query = query.eq('company_id', companyId)
  }
  
  const { data, error } = await query.maybeSingle()
  
  if (error || !data) {
    return false
  }
  
  return true
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
 * Get all company IDs where user is admin or owner (using profiles.role)
 * Supports both old and new role names for backward compatibility
 */
export async function getUserAdminCompanies(userId: string): Promise<string[]> {
  const supabase = createServerSupabaseClient()
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .in('role', ['warehouse_owner', 'warehouse_admin', 'warehouse_supervisor'])
    .not('company_id', 'is', null)
  
  if (error || !profiles) {
    return []
  }
  
  return profiles.map(p => p.company_id).filter((id): id is string => id !== null)
}

