'use client'

import { useEffect } from 'react'
import { useRealtimeNotifications } from '@/lib/realtime/hooks'
import { useUIStore } from '@/stores/ui.store'
import { useUser } from '@/lib/hooks/use-user'

/**
 * Hook to show toast notifications for important events
 * Automatically shows toast when new notifications arrive
 */
export function useToastNotifications() {
  const { user } = useUser()
  const { notifications, markAsRead } = useRealtimeNotifications(user?.id || '')
  const { addNotification } = useUIStore()

  useEffect(() => {
    // Get the latest notification
    const latestNotification = notifications[0]

    if (
      latestNotification &&
      !latestNotification.read &&
      notifications.length > 0
    ) {
      // Determine toast type based on notification type
      let toastType: 'success' | 'error' | 'warning' | 'info' = 'info'

      switch (latestNotification.type) {
        case 'booking':
          if (latestNotification.title.toLowerCase().includes('approved')) {
            toastType = 'success'
          } else if (latestNotification.title.toLowerCase().includes('rejected')) {
            toastType = 'error'
          } else {
            toastType = 'info'
          }
          break
        case 'invoice':
          if (latestNotification.title.toLowerCase().includes('overdue')) {
            toastType = 'warning'
          } else if (latestNotification.title.toLowerCase().includes('paid')) {
            toastType = 'success'
          } else {
            toastType = 'info'
          }
          break
        case 'incident':
          toastType = 'warning'
          break
        case 'system':
          toastType = 'info'
          break
        default:
          toastType = 'info'
      }

      // Show toast
      addNotification({
        type: toastType,
        message: `${latestNotification.title}\n${latestNotification.message}`,
        duration: 5000, // 5 seconds
      })

      // Mark as read after showing toast
      setTimeout(() => {
        markAsRead(latestNotification.id)
      }, 100)
    }
  }, [notifications, addNotification, markAsRead])
}

