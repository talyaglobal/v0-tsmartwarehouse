import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Search companies by name (public – used on register page without auth)
 * GET /api/v1/companies/search?q=searchterm&type=customer_company|client_company
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const q = searchParams.get('q') || ''
    const companyType = searchParams.get('type') || 'customer_company'

    if (!q || q.trim().length < 2) {
      return NextResponse.json({ companies: [] })
    }

    // Validate company type
    const validTypes = ['customer_company', 'client_company']
    const finalType = validTypes.includes(companyType) ? companyType : 'customer_company'

    let supabase
    try {
      supabase = createAdminClient()
    } catch (adminError) {
      console.error('Company search: createAdminClient failed (missing SUPABASE_SERVICE_ROLE_KEY?):', adminError)
      return NextResponse.json({ companies: [], error: 'Search unavailable' })
    }

    const trimmedQuery = q.trim()

    const baseSelect = 'id, short_name, trading_name, type'

    // 1) Try with status = true (active companies only)
    const withStatus = await supabase
      .from('companies')
      .select(baseSelect)
      .ilike('short_name', `%${trimmedQuery}%`)
      .eq('type', finalType)
      .eq('status', true)
      .order('short_name', { ascending: true })
      .limit(10)

    let companiesData = withStatus.data

    if (withStatus.error) {
      // status column may not exist – retry without it
      const withoutStatus = await supabase
        .from('companies')
        .select(baseSelect)
        .ilike('short_name', `%${trimmedQuery}%`)
        .eq('type', finalType)
        .order('short_name', { ascending: true })
        .limit(10)
      if (withoutStatus.error) {
        console.error('Error searching companies:', withoutStatus.error)
        return NextResponse.json(
          { error: 'Failed to search companies', companies: [] },
          { status: 500 }
        )
      }
      companiesData = withoutStatus.data
    } else if (!companiesData?.length) {
      // 2) No rows with status=true – fallback: same search without status
      const withoutStatus = await supabase
        .from('companies')
        .select(baseSelect)
        .ilike('short_name', `%${trimmedQuery}%`)
        .eq('type', finalType)
        .order('short_name', { ascending: true })
        .limit(10)
      if (!withoutStatus.error && withoutStatus.data?.length) {
        companiesData = withoutStatus.data
      }
    }

    if (!companiesData?.length) {
      // 3) Try matching trading_name as well (in case name is only there)
      const byTrading = await supabase
        .from('companies')
        .select(baseSelect)
        .ilike('trading_name', `%${trimmedQuery}%`)
        .eq('type', finalType)
        .order('short_name', { ascending: true })
        .limit(10)
      if (!byTrading.error && byTrading.data?.length) {
        companiesData = byTrading.data
      }
    }

    if (!companiesData?.length) {
      // 4) Still empty – try without type filter (short_name only), then filter to client_company
      const anyType = await supabase
        .from('companies')
        .select(baseSelect)
        .ilike('short_name', `%${trimmedQuery}%`)
        .order('short_name', { ascending: true })
        .limit(20)
      if (!anyType.error && anyType.data?.length) {
        companiesData = anyType.data.filter((c) => c.type === finalType)
      }
    }

    // Map short_name to name for backward compatibility
    let companies = (companiesData || []).map(c => ({
      ...c,
      name: c.short_name // Keep name field for backward compatibility
    }))

    // Check for exact match and put it first
    const exactMatch = companies.find(
      (c) => c.short_name?.toLowerCase() === trimmedQuery.toLowerCase()
    )
    
    // If exact match exists, put it first
    if (exactMatch) {
      const filtered = companies.filter((c) => c.id !== exactMatch.id)
      companies = [exactMatch, ...filtered]
    }

    return NextResponse.json({ companies: companies || [] })
  } catch (error: any) {
    console.error('Error in company search:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

