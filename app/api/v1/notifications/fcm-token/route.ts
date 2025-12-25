import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Save FCM token to user profile
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get FCM token from request body
    const body = await request.json()
    const { token } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid FCM token' },
        { status: 400 }
      )
    }

    // Update user profile with FCM token
    const { error } = await supabase
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', user.id)

    if (error) {
      console.error('Error saving FCM token:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save FCM token' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'FCM token saved successfully',
    })
  } catch (error) {
    console.error('Error in FCM token endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

