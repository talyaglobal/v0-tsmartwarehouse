"use client"

import { Wifi, WifiOff } from "@/components/icons"
import { useRealtimeConnectionStatus } from "@/lib/realtime"
import { cn } from "@/lib/utils"

interface RealtimeIndicatorProps {
  className?: string
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
}

export function RealtimeIndicator({ className, showLabel = false, size = "md" }: RealtimeIndicatorProps) {
  const isConnected = useRealtimeConnectionStatus()

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {isConnected ? (
        <>
          <span title="Real-time connected">
            <Wifi className={cn(sizeClasses[size], "text-green-500")} />
          </span>
          {showLabel && <span className="text-xs text-green-600">Live</span>}
        </>
      ) : (
        <>
          <span title="Real-time disconnected">
            <WifiOff className={cn(sizeClasses[size], "text-muted-foreground")} />
          </span>
          {showLabel && <span className="text-xs text-muted-foreground">Offline</span>}
        </>
      )}
    </div>
  )
}

