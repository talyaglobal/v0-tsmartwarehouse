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
    const role = searchParams.get('role')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = await createClient()

    // Build query
    let query = supabase
      .from('profiles')
      .select(`
        id,
        email,
        name,
        role,
        company_id,
        created_at,
        companies:company_id(name)
      `)
      .order('created_at', { ascending: false })

    // Apply role filter
    if (role && role !== 'all') {
      query = query.eq('role', role)
    }

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users', details: error.message },
        { status: 500 }
      )
    }

    // Get role counts
    const { data: roleCountsData } = await supabase
      .from('profiles')
      .select('role')

    const roleCounts: Record<string, number> = {}
    roleCountsData?.forEach((p: any) => {
      if (p.role) {
        roleCounts[p.role] = (roleCounts[p.role] || 0) + 1
      }
    })

    // Transform data
    const users = (data || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      full_name: row.name,
      role: row.role,
      company_id: row.company_id,
      company_name: row.companies?.name || null,
      created_at: row.created_at,
    }))

    return NextResponse.json({
      success: true,
      data: users,
      roleCounts,
      total: users.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in admin users API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
