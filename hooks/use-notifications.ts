"use client"

import useSWR from "swr"
import { notificationService } from "@/modules/notifications/services/notifier"

export function useNotifications(userId: string, unreadOnly = false) {
  const key = userId ? ["notifications", userId, unreadOnly] : null

  const { data, error, isLoading, mutate } = useSWR(key, () =>
    notificationService.getUserNotifications(userId, unreadOnly),
  )

  const markAsRead = async (notificationId: string) => {
    await notificationService.markAsRead(notificationId)
    mutate()
  }

  const markAllAsRead = async () => {
    await notificationService.markAllAsRead(userId)
    mutate()
  }

  return {
    notifications: data ?? [],
    isLoading,
    isError: !!error,
    error,
    markAsRead,
    markAllAsRead,
    mutate,
  }
}

export function useUnreadCount(userId: string) {
  const { data, error, isLoading } = useSWR(userId ? ["unread-count", userId] : null, () =>
    notificationService.getUnreadCount(userId),
  )

  return {
    count: data ?? 0,
    isLoading,
    isError: !!error,
  }
}
