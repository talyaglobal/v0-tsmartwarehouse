import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Search companies by name
 * GET /api/v1/companies/search?q=searchterm
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ companies: [] })
    }

    const supabase = createServerSupabaseClient()

    const trimmedQuery = query.trim()
    
    const { data: companiesData, error } = await supabase
      .from('companies')
      .select('id, name, type')
      .ilike('name', `%${trimmedQuery}%`)
      .eq('type', 'customer_company')
      .order('name', { ascending: true })
      .limit(10)

    if (error) {
      console.error('Error searching companies:', error)
      return NextResponse.json(
        { error: 'Failed to search companies' },
        { status: 500 }
      )
    }

    let companies = companiesData || []

    // Check for exact match and put it first
    const exactMatch = companies.find(
      (c) => c.name.toLowerCase() === trimmedQuery.toLowerCase()
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

