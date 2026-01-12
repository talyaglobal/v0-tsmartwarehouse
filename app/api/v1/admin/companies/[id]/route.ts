import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/utils'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user || !['root', 'warehouse_admin', 'warehouse_supervisor'].includes(user.role || '')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { id } = await params
    const supabase = await createClient()

    // Get company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    // Get members
    const { data: members } = await supabase
      .from('profiles')
      .select('id, name, email, role, created_at')
      .eq('company_id', id)
      .order('created_at', { ascending: false })

    // Get warehouses
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select('id, name, city, total_sq_ft, status')
      .eq('owner_company_id', id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      data: {
        company,
        members: members || [],
        warehouses: warehouses || [],
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching company:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user || !['root', 'warehouse_admin', 'warehouse_supervisor'].includes(user.role || '')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Company name is required' },
        { status: 400 }
      )
    }

    // Update company
    const { data: company, error } = await supabase
      .from('companies')
      .update({
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        city: body.city?.trim() || null,
        country: body.country?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating company:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update company', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: company,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating company:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.role !== 'root') {
      return NextResponse.json(
        { success: false, error: 'Only root users can delete companies' },
        { status: 403 }
      )
    }

    const { id } = await params
    const supabase = await createClient()

    // Check if company has warehouses or members
    const { count: warehouseCount } = await supabase
      .from('warehouses')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id)

    const { count: memberCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id)

    if ((warehouseCount || 0) > 0 || (memberCount || 0) > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete company with existing warehouses or members. Please remove them first.' 
        },
        { status: 400 }
      )
    }

    // Delete company
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting company:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete company', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Company deleted successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error deleting company:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
