'use client'

import { useUIStore } from '@/stores/ui.store'

interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info'
  duration?: number
}

export function useToast() {
  const { addNotification } = useUIStore()

  const toast = ({ title, description, variant = 'default', duration = 5000 }: ToastOptions) => {
    const message = title && description ? `${title}\n${description}` : title || description || ''

    // Map variant to notification type
    let type: 'success' | 'error' | 'warning' | 'info' = 'info'
    if (variant === 'destructive') {
      type = 'error'
    } else if (variant === 'success') {
      type = 'success'
    } else if (variant === 'warning') {
      type = 'warning'
    } else {
      type = 'info'
    }

    addNotification({
      type,
      message,
      duration,
    })
  }

  return { toast }
}

