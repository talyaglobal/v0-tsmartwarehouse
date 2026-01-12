import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user || !['root', 'warehouse_admin', 'warehouse_supervisor'].includes(user.role || '')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = await createClient()

    // Build query
    let query = supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: companies, error } = await query

    if (error) {
      console.error('Error fetching companies:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch companies', details: error.message },
        { status: 500 }
      )
    }

    // Get member counts for each company
    const companyIds = companies?.map(c => c.id) || []
    
    let memberCounts: Record<string, number> = {}
    let warehouseCounts: Record<string, number> = {}

    if (companyIds.length > 0) {
      // Get member counts
      const { data: members } = await supabase
        .from('profiles')
        .select('company_id')
        .in('company_id', companyIds)

      members?.forEach((m: any) => {
        if (m.company_id) {
          memberCounts[m.company_id] = (memberCounts[m.company_id] || 0) + 1
        }
      })

      // Get warehouse counts
      const { data: warehouses } = await supabase
        .from('warehouses')
        .select('company_id')
        .in('company_id', companyIds)

      warehouses?.forEach((w: any) => {
        if (w.company_id) {
          warehouseCounts[w.company_id] = (warehouseCounts[w.company_id] || 0) + 1
        }
      })
    }

    // Transform data
    const transformedCompanies = (companies || []).map((company: any) => ({
      id: company.id,
      name: company.name,
      email: company.email,
      phone: company.phone,
      address: company.address,
      city: company.city,
      country: company.country,
      logo_url: company.logo_url,
      member_count: memberCounts[company.id] || 0,
      warehouse_count: warehouseCounts[company.id] || 0,
      created_at: company.created_at,
    }))

    return NextResponse.json({
      success: true,
      data: transformedCompanies,
      total: transformedCompanies.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in admin companies API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
