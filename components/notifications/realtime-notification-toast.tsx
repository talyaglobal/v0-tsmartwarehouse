'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useUser } from '@/lib/hooks/use-user'
import { useNotificationSubscription } from '@/lib/realtime/notification-subscription'
import { useUIStore } from '@/stores/ui.store'
import type { Notification } from '@/types'

interface RealtimeNotificationToastProps {
  /**
   * Whether to play a sound when a new notification arrives
   */
  enableSound?: boolean
  /**
   * Duration for the toast notification (in milliseconds)
   */
  toastDuration?: number
}

/**
 * Create a notification sound using Web Audio API
 * This avoids the need for an external sound file
 */
function createNotificationSound(audioContext: AudioContext): void {
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  // Two-tone notification sound
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime) // A5
  oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.1) // C#6
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.3)
}

/**
 * Component that listens to real-time notifications and shows toast messages
 * Add this component to your layout to enable real-time notification toasts
 */
export function RealtimeNotificationToast({
  enableSound = true,
  toastDuration = 6000,
}: RealtimeNotificationToastProps) {
  const { user } = useUser()
  const { addNotification } = useUIStore()
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize audio context on first user interaction
  useEffect(() => {
    if (enableSound && typeof window !== 'undefined') {
      // Create audio context lazily (browsers require user interaction first)
      const initAudioContext = () => {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
      }
      
      // Listen for first user interaction to enable audio
      const handleInteraction = () => {
        initAudioContext()
        // Resume if suspended
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume()
        }
      }

      document.addEventListener('click', handleInteraction, { once: true })
      document.addEventListener('keydown', handleInteraction, { once: true })
      
      return () => {
        document.removeEventListener('click', handleInteraction)
        document.removeEventListener('keydown', handleInteraction)
        if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
      }
    }
  }, [enableSound])

  // Play notification sound
  const playSound = useCallback(() => {
    if (enableSound && audioContextRef.current && audioContextRef.current.state === 'running') {
      try {
        createNotificationSound(audioContextRef.current)
      } catch (error) {
        // Ignore audio errors
        console.warn('Could not play notification sound:', error)
      }
    }
  }, [enableSound])

  // Handle new notification
  const handleNewNotification = useCallback(
    (notification: Notification) => {
      // Determine toast type based on notification type
      let toastType: 'success' | 'error' | 'warning' | 'info' = 'info'
      
      switch (notification.type) {
        case 'booking':
          toastType = 'success'
          break
        case 'incident':
          toastType = 'warning'
          break
        case 'invoice':
          toastType = 'info'
          break
        case 'task':
          toastType = 'info'
          break
        case 'system':
        default:
          toastType = 'info'
          break
      }

      // Show toast
      addNotification({
        type: toastType,
        message: `${notification.title}\n${notification.message}`,
        duration: toastDuration,
      })

      // Play sound
      playSound()
    },
    [addNotification, toastDuration, playSound]
  )

  // Subscribe to real-time notifications
  const { isConnected, error } = useNotificationSubscription({
    userId: user?.id || '',
    onNewNotification: handleNewNotification,
    autoReconnect: true,
    reconnectDelay: 3000,
  })

  // Log connection status in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (isConnected) {
      } else if (error) {
        console.warn('🔔 Real-time notifications error:', error.message)
      }
    }
  }, [isConnected, error])

  // This component doesn't render anything visible
  return null
}
