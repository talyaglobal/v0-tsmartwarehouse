'use client'

// Simple time ago formatter
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return `${Math.floor(seconds / 604800)}w ago`
}
import { useRealtimeNotifications } from '@/lib/realtime/hooks'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types'
import {
  Bell,
  FileText,
  Package,
  AlertTriangle,
  Settings,
} from 'lucide-react'

interface NotificationItemProps {
  notification: Notification
}

const typeIcons = {
  booking: Package,
  invoice: FileText,
  task: Bell,
  incident: AlertTriangle,
  system: Settings,
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const { markAsRead } = useRealtimeNotifications(notification.userId)

  const Icon = typeIcons[notification.type] || Bell

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
  }

  const timeAgo = formatTimeAgo(new Date(notification.createdAt))

  return (
    <div
      className={cn(
        'p-4 hover:bg-accent cursor-pointer transition-colors',
        !notification.read && 'bg-accent/50'
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-2 rounded-full',
            !notification.read
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={cn(
                'text-sm font-medium',
                !notification.read && 'font-semibold'
              )}
            >
              {notification.title}
            </h4>
            {!notification.read && (
              <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-2">{timeAgo}</p>
        </div>
      </div>
    </div>
  )
}

