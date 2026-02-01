import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        name,
        role,
        company_id,
        created_at,
        companies:company_id(id, short_name)
      `)
      .eq('id', id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const companyData = profile.companies as unknown as { id: string; short_name: string } | null

    return NextResponse.json({
      success: true,
      data: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        full_name: profile.name,
        role: profile.role,
        company_id: profile.company_id,
        company_name: companyData?.short_name || null,
        created_at: profile.created_at,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching user:', error)
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

    // Only root can change roles to root
    if (body.role === 'root' && user.role !== 'root') {
      return NextResponse.json(
        { success: false, error: 'Only root users can assign root role' },
        { status: 403 }
      )
    }

    // Only root can change email addresses
    if (body.email !== undefined && user.role !== 'root') {
      return NextResponse.json(
        { success: false, error: 'Only root users can change email addresses' },
        { status: 403 }
      )
    }

    // Only root can change passwords
    if (body.password !== undefined && user.role !== 'root') {
      return NextResponse.json(
        { success: false, error: 'Only root users can change passwords' },
        { status: 403 }
      )
    }

    // Build update object for profiles table
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.name !== undefined) {
      updateData.name = body.name?.trim() || null
    }

    if (body.role !== undefined) {
      updateData.role = body.role
    }

    // Handle email change (only for root users)
    if (body.email !== undefined && user.role === 'root') {
      const newEmail = body.email?.trim()
      
      if (!newEmail || !newEmail.includes('@')) {
        return NextResponse.json(
          { success: false, error: 'Invalid email address' },
          { status: 400 }
        )
      }

      // Get current user email to check if it changed
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', id)
        .single()

      if (currentProfile && currentProfile.email !== newEmail) {
        // Update email in Supabase Auth using Admin API
        const adminClient = createAdminClient()
        
        const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
          email: newEmail,
          email_confirm: true, // Auto-confirm the new email
        })

        if (authError) {
          console.error('Error updating auth email:', authError)
          return NextResponse.json(
            { success: false, error: `Failed to update email in Auth: ${authError.message}` },
            { status: 500 }
          )
        }

        // Also update email in profiles table
        updateData.email = newEmail
      }
    }

    // Handle password change (only for root users)
    if (body.password !== undefined && user.role === 'root') {
      const newPassword = body.password?.trim()
      
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 6 characters' },
          { status: 400 }
        )
      }

      // Update password in Supabase Auth using Admin API
      const adminClient = createAdminClient()
      
      const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
        password: newPassword,
      })

      if (authError) {
        console.error('Error updating auth password:', authError)
        return NextResponse.json(
          { success: false, error: `Failed to update password: ${authError.message}` },
          { status: 500 }
        )
      }
    }

    // Update user profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating user:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update user', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating user:', error)
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
        { success: false, error: 'Only root users can delete users' },
        { status: 403 }
      )
    }

    const { id } = await params
    const supabase = await createClient()

    // Prevent self-deletion
    if (id === user.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Delete user profile (this will cascade or be handled by auth)
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting user:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete user', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
