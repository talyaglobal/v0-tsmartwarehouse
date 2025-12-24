/**
 * Enhanced notification subscription hook
 * Provides auto-reconnect and better error handling
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Notification } from '@/types'

export interface UseNotificationSubscriptionOptions {
  userId: string
  onNewNotification?: (notification: Notification) => void
  autoReconnect?: boolean
  reconnectDelay?: number
}

export function useNotificationSubscription({
  userId,
  onNewNotification,
  autoReconnect = true,
  reconnectDelay = 3000,
}: UseNotificationSubscriptionOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isConnectingRef = useRef(false)

  const connect = useCallback(() => {
    if (isConnectingRef.current || !userId) return

    isConnectingRef.current = true
    const supabase = createClient()

    try {
      // Remove existing channel if any
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }

      // Create new channel
      const channel = supabase
        .channel(`notifications_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            const notification = payload.new as Notification
            if (onNewNotification) {
              onNewNotification(notification)
            }
          }
        )
        .subscribe((status: string) => {
          setIsConnected(status === 'SUBSCRIBED')
          setError(null)
          isConnectingRef.current = false

          if (status === 'SUBSCRIBED') {
            // Clear any pending reconnect
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current)
              reconnectTimeoutRef.current = null
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setError(new Error(`Connection error: ${status}`))
            isConnectingRef.current = false

            // Auto-reconnect if enabled
            if (autoReconnect && !reconnectTimeoutRef.current) {
              reconnectTimeoutRef.current = setTimeout(() => {
                reconnectTimeoutRef.current = null
                connect()
              }, reconnectDelay)
            }
          }
        })

      channelRef.current = channel
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      isConnectingRef.current = false

      // Auto-reconnect on error
      if (autoReconnect && !reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null
          connect()
        }, reconnectDelay)
      }
    }
  }, [userId, onNewNotification, autoReconnect, reconnectDelay])

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      const supabase = createClient()
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    setIsConnected(false)
    setError(null)

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (userId) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [userId, connect, disconnect])

  return {
    isConnected,
    error,
    reconnect: connect,
    disconnect,
  }
}

