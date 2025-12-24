'use client'

import { Bell } from 'lucide-react'
import { useRealtimeNotifications } from '@/lib/realtime/hooks'
import { useUser } from '@/lib/hooks/use-user'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NotificationCenter } from './notification-center'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { user } = useUser()
  const { unreadCount, isConnected } = useRealtimeNotifications(user?.id || '')

  if (!user) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative', className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          {!isConnected && (
            <span className="absolute -bottom-1 -right-1 h-2 w-2 bg-yellow-500 rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <NotificationCenter />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

