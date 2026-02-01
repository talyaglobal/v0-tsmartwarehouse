import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Search companies by name
 * GET /api/v1/companies/search?q=searchterm&type=customer_company|client_company
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const companyType = searchParams.get('type') || 'customer_company'

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ companies: [] })
    }

    // Validate company type
    const validTypes = ['customer_company', 'client_company']
    const finalType = validTypes.includes(companyType) ? companyType : 'customer_company'

    const supabase = createServerSupabaseClient()

    const trimmedQuery = query.trim()
    
    const { data: companiesData, error } = await supabase
      .from('companies')
      .select('id, short_name, trading_name, type')
      .ilike('short_name', `%${trimmedQuery}%`)
      .eq('type', finalType)
      .order('short_name', { ascending: true })
      .limit(10)

    if (error) {
      console.error('Error searching companies:', error)
      return NextResponse.json(
        { error: 'Failed to search companies' },
        { status: 500 }
      )
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

    if (error) {
      console.error('Error searching companies:', error)
      return NextResponse.json(
        { error: 'Failed to search companies' },
        { status: 500 }
      )
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

