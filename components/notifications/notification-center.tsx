'use client'

import { useRealtimeNotifications } from '@/lib/realtime/hooks'
import { useUser } from '@/lib/hooks/use-user'
import { NotificationItem } from './notification-item'
import { Button } from '@/components/ui/button'
// ScrollArea component (simple implementation)
const ScrollArea = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={className} style={{ overflowY: 'auto' }}>
    {children}
  </div>
)
import { Separator } from '@/components/ui/separator'
import { Inbox } from 'lucide-react'

export function NotificationCenter() {
  const { user } = useUser()
  const {
    notifications,
    unreadCount,
    isConnected,
    markAllAsRead,
  } = useRealtimeNotifications(user?.id || '')

  if (!user) {
    return null
  }

  const unreadNotifications = notifications.filter((n) => !n.read)
  const readNotifications = notifications.filter((n) => n.read)

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-sm text-muted-foreground">
              ({unreadCount} unread)
            </span>
          )}
          {!isConnected && (
            <span className="text-xs text-yellow-600">Disconnected</span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="text-xs"
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <ScrollArea className="flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">No notifications</p>
          </div>
        ) : (
          <div className="divide-y">
            {/* Unread notifications */}
            {unreadNotifications.length > 0 && (
              <>
                {unreadNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                  />
                ))}
                {readNotifications.length > 0 && (
                  <>
                    <Separator />
                    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                      Older
                    </div>
                  </>
                )}
              </>
            )}

            {/* Read notifications */}
            {readNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

