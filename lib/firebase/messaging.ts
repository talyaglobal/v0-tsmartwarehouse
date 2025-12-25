'use client'

import { getToken, onMessage, MessagePayload } from 'firebase/messaging'
import { getFirebaseMessaging } from './config'

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.error('This browser does not support notifications')
      return null
    }

    // Request permission
    const permission = await Notification.requestPermission()
    
    if (permission !== 'granted') {
      console.log('Notification permission denied')
      return null
    }

    // Get messaging instance
    const messaging = await getFirebaseMessaging()
    if (!messaging) {
      console.error('Firebase Messaging not supported')
      return null
    }

    // Get FCM token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    })

    if (token) {
      console.log('FCM Token:', token)
      return token
    } else {
      console.log('No registration token available')
      return null
    }
  } catch (error) {
    console.error('Error getting notification permission:', error)
    return null
  }
}

/**
 * Listen for foreground messages
 */
export function onForegroundMessage(callback: (payload: MessagePayload) => void) {
  getFirebaseMessaging().then((messaging) => {
    if (!messaging) {
      console.error('Firebase Messaging not supported')
      return
    }

    onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload)
      callback(payload)
    })
  })
}

/**
 * Check if notifications are supported
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | null {
  if (!isNotificationSupported()) {
    return null
  }
  return Notification.permission
}

/**
 * Save FCM token to user profile
 */
export async function saveFCMToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('/api/v1/notifications/fcm-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })

    if (!response.ok) {
      throw new Error('Failed to save FCM token')
    }

    return true
  } catch (error) {
    console.error('Error saving FCM token:', error)
    return false
  }
}

