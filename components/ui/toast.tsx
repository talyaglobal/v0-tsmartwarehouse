"use client"

import React, { useEffect } from "react"
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { useUIStore } from "@/stores/ui.store"
import { cn } from "@/lib/utils"

export function ToastContainer() {
  const { notifications, removeNotification } = useUIStore()

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full">
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  )
}

interface ToastProps {
  notification: {
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
    duration?: number
  }
  onClose: () => void
}

function Toast({ notification, onClose }: ToastProps) {
  useEffect(() => {
    if (notification.duration !== undefined && notification.duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, notification.duration)

      return () => clearTimeout(timer)
    }
  }, [notification.duration, onClose])

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }

  const styles = {
    success: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200",
    error: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200",
    warning: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200",
    info: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
  }

  const Icon = icons[notification.type]

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border shadow-lg transition-all duration-300 ease-in-out toast-enter",
        styles[notification.type]
      )}
      role="alert"
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{notification.message}</p>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

