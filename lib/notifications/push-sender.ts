/**
 * Server-side push notification sender using Firebase Cloud Messaging
 */

const FIREBASE_SERVER_KEY = process.env.FIREBASE_SERVER_KEY
const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send'

interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  data?: Record<string, string>
}

/**
 * Send push notification to a specific FCM token
 */
export async function sendPushNotification(
  token: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!FIREBASE_SERVER_KEY) {
    console.error('FIREBASE_SERVER_KEY not configured')
    return false
  }

  try {
    const response = await fetch(FCM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${FIREBASE_SERVER_KEY}`,
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon.svg',
        },
        data: payload.data || {},
      }),
    })

    if (!response.ok) {
      console.error('Failed to send push notification:', await response.text())
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending push notification:', error)
    return false
  }
}

/**
 * Send push notification to a user by their ID
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = await createServerSupabaseClient()

    // Get user's FCM token from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('fcm_token')
      .eq('id', userId)
      .single()

    if (!profile?.fcm_token) {
      return false
    }

    return await sendPushNotification(profile.fcm_token, payload)
  } catch (error) {
    console.error('Error sending push notification to user:', error)
    return false
  }
}

/**
 * Send push notification to all admins
 */
export async function sendPushNotificationToAdmins(
  payload: PushNotificationPayload
): Promise<number> {
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = await createServerSupabaseClient()

    // Get all admin FCM tokens
    const { data: admins } = await supabase
      .from('profiles')
      .select('fcm_token')
      .eq('role', 'super_admin')
      .not('fcm_token', 'is', null)

    if (!admins || admins.length === 0) {
      return 0
    }

    // Send to all admins
    let successCount = 0
    await Promise.all(
      admins.map(async (admin) => {
        if (admin.fcm_token) {
          const success = await sendPushNotification(admin.fcm_token, payload)
          if (success) successCount++
        }
      })
    )

    return successCount
  } catch (error) {
    console.error('Error sending push notification to admins:', error)
    return 0
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushNotificationPayload
): Promise<number> {
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = await createServerSupabaseClient()

    // Get FCM tokens for all users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('fcm_token')
      .in('id', userIds)
      .not('fcm_token', 'is', null)

    if (!profiles || profiles.length === 0) {
      return 0
    }

    // Send to all users
    let successCount = 0
    await Promise.all(
      profiles.map(async (profile) => {
        if (profile.fcm_token) {
          const success = await sendPushNotification(profile.fcm_token, payload)
          if (success) successCount++
        }
      })
    )

    return successCount
  } catch (error) {
    console.error('Error sending push notification to users:', error)
    return 0
  }
}

