/**
 * Database operations for Companies
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'

export type CompanyType = 'warehouse_company' | 'customer_company'

export interface Company {
  id: string
  name: string
  type: CompanyType
  logoUrl?: string
  createdAt: string
  updatedAt: string
}

interface GetCompaniesOptions {
  type?: CompanyType
  limit?: number
  offset?: number
}

/**
 * Get companies with optional filters
 */
export async function getCompanies(
  filters?: GetCompaniesOptions
): Promise<Company[]> {
  const supabase = await createServerSupabaseClient()
  let query = supabase.from('companies').select('*')

  if (filters?.type) {
    query = query.eq('type', filters.type)
  }

  if (filters?.limit) {
    query = query.range(
      filters.offset || 0,
      (filters.offset || 0) + filters.limit - 1
    )
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch companies: ${error.message}`)
  }

  return (data || []).map(transformCompanyRow)
}

/**
 * Get company by ID
 */
export async function getCompanyById(id: string): Promise<Company | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch company: ${error.message}`)
  }

  return transformCompanyRow(data)
}

/**
 * Create a new company
 */
export async function createCompany(
  company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Company> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('companies')
    .insert({
      name: company.name,
      type: company.type,
      logo_url: company.logoUrl,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create company: ${error.message}`)
  }

  return transformCompanyRow(data)
}

/**
 * Update company
 */
export async function updateCompany(
  id: string,
  updates: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Company> {
  const supabase = await createServerSupabaseClient()

  const updateData: any = {}
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.type !== undefined) updateData.type = updates.type
  if (updates.logoUrl !== undefined) updateData.logo_url = updates.logoUrl

  const { data, error } = await supabase
    .from('companies')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update company: ${error.message}`)
  }

  return transformCompanyRow(data)
}

/**
 * Delete company
 */
export async function deleteCompany(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.from('companies').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete company: ${error.message}`)
  }
}

/**
 * Transform database row to Company type
 */
function transformCompanyRow(row: any): Company {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

