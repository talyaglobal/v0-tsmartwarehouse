'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import {
  requestNotificationPermission,
  onForegroundMessage,
  isNotificationSupported,
  getNotificationPermission,
  saveFCMToken,
} from '@/lib/firebase/messaging'

export function PushNotificationSetup() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Check initial permission status
    const currentPermission = getNotificationPermission()
    setPermission(currentPermission)

    // Listen for foreground messages
    if (currentPermission === 'granted') {
      onForegroundMessage((payload) => {
        toast({
          title: payload.notification?.title || 'New Notification',
          description: payload.notification?.body || 'You have a new notification',
        })
      })
    }
  }, [toast])

  const handleEnableNotifications = async () => {
    setIsLoading(true)

    try {
      const token = await requestNotificationPermission()

      if (token) {
        // Save token to user profile
        const saved = await saveFCMToken(token)

        if (saved) {
          setPermission('granted')
          toast({
            title: 'Notifications Enabled',
            description: 'You will now receive push notifications',
          })
        } else {
          toast({
            title: 'Error',
            description: 'Failed to save notification settings',
            variant: 'destructive',
          })
        }
      } else {
        setPermission('denied')
        toast({
          title: 'Permission Denied',
          description: 'Please enable notifications in your browser settings',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error enabling notifications:', error)
      toast({
        title: 'Error',
        description: 'Failed to enable notifications',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isNotificationSupported()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Push Notifications Not Supported
          </CardTitle>
          <CardDescription>
            Your browser does not support push notifications
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (permission === 'granted') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-green-600" />
            Push Notifications Enabled
          </CardTitle>
          <CardDescription>
            You are receiving push notifications for important updates
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (permission === 'denied') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-red-600" />
            Push Notifications Blocked
          </CardTitle>
          <CardDescription>
            Please enable notifications in your browser settings to receive updates
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Enable Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about important updates, new tasks, and booking status changes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleEnableNotifications} disabled={isLoading}>
          {isLoading ? 'Enabling...' : 'Enable Notifications'}
        </Button>
      </CardContent>
    </Card>
  )
}

