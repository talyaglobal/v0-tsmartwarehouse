import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Check if user is Root (System Admin)
 */
export async function isRoot(userId: string): Promise<boolean> {
  const supabase = createServerSupabaseClient()
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', userId)
    .eq('role', 'root')
    .maybeSingle()
  
  if (error || !profile) {
    return false
  }
  
  // Root should be in system company
  if (profile.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('is_system')
      .eq('id', profile.company_id)
      .maybeSingle()
    
    return company?.is_system === true
  }
  
  return true // Root can exist without company_id (legacy)
}

/**
 * Check if user is Company Admin
 */
export async function isCompanyAdmin(userId: string, companyId?: string): Promise<boolean> {
  const supabase = createServerSupabaseClient()
  
  let query = supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', userId)
    .eq('role', 'company_admin')
  
  if (companyId) {
    query = query.eq('company_id', companyId)
  }
  
  const { data, error } = await query.maybeSingle()
  
  return !error && !!data
}

/**
 * Check if user is Warehouse Staff
 */
export async function isWarehouseStaff(userId: string, companyId?: string): Promise<boolean> {
  const supabase = createServerSupabaseClient()
  
  let query = supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', userId)
    .eq('role', 'warehouse_staff')
  
  if (companyId) {
    query = query.eq('company_id', companyId)
  }
  
  const { data, error } = await query.maybeSingle()
  
  return !error && !!data
}

/**
 * Check if user is Member (Customer)
 */
export async function isMember(userId: string, companyId?: string): Promise<boolean> {
  const supabase = createServerSupabaseClient()
  
  let query = supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', userId)
    .eq('role', 'member')
  
  if (companyId) {
    query = query.eq('company_id', companyId)
  }
  
  const { data, error } = await query.maybeSingle()
  
  return !error && !!data
}

/**
 * KVKK Compliance: Check if user can access company data
 * Root users can only access system company data, not other companies' data
 * Other users can only access their own company's data
 */
export async function canAccessCompanyData(userId: string, targetCompanyId: string): Promise<boolean> {
  const supabase = createServerSupabaseClient()
  
  // Get user's profile
  const { data: userProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', userId)
    .maybeSingle()
  
  if (profileError || !userProfile) {
    return false
  }
  
  // Root users: Can only access system company
  if (userProfile.role === 'root') {
    const { data: targetCompany } = await supabase
      .from('companies')
      .select('is_system')
      .eq('id', targetCompanyId)
      .maybeSingle()
    
    // Root can access system company or if target company is system company
    return targetCompany?.is_system === true || userProfile.company_id === targetCompanyId
  }
  
  // All other users: Can only access their own company
  return userProfile.company_id === targetCompanyId
}

/**
 * Get System Company ID
 */
export async function getSystemCompanyId(): Promise<string | null> {
  const supabase = createServerSupabaseClient()
  
  const { data: company, error } = await supabase
    .from('companies')
    .select('id')
    .eq('is_system', true)
    .maybeSingle()
  
  if (error || !company) {
    return null
  }
  
  return company.id
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
    .maybeSingle()
  
  if (error || !profile) {
    return null
  }
  
  return profile.company_id
}

/**
 * Check if user has permission to perform action on company data
 * This is the main KVKK compliance check
 */
export async function hasCompanyAccess(userId: string, targetCompanyId: string | null): Promise<boolean> {
  if (!targetCompanyId) {
    // If no target company, only root can access
    return await isRoot(userId)
  }
  
  return await canAccessCompanyData(userId, targetCompanyId)
}

