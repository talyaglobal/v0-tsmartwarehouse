import type { Notification, SendNotificationRequest, NotificationPreferences } from "../types"

const notifications: Notification[] = []

const defaultPreferences: NotificationPreferences = {
  user_id: "",
  email_enabled: true,
  sms_enabled: false,
  push_enabled: true,
  whatsapp_enabled: false,
  types: {
    booking: true,
    payment: true,
    incident: true,
    task: true,
    system: true,
  },
}

export class NotificationService {
  private static instance: NotificationService

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  async send(request: SendNotificationRequest): Promise<Notification> {
    const notification: Notification = {
      id: `notif-${Date.now()}`,
      user_id: request.user_id,
      type: request.type,
      title: request.title,
      message: request.message,
      data: request.data,
      is_read: false,
      created_at: new Date().toISOString(),
    }

    notifications.push(notification)

    // In real implementation, would send via requested channels
    const channels = request.channels ?? ["push"]
    for (const channel of channels) {
      await this.sendViaChannel(channel, notification)
    }

    return notification
  }

  private async sendViaChannel(
    channel: "email" | "sms" | "push" | "whatsapp",
    notification: Notification,
  ): Promise<void> {
    // Mock implementation - would integrate with actual services
    console.log(`Sending notification via ${channel}:`, notification.title)
  }

  async getUserNotifications(userId: string, unreadOnly = false): Promise<Notification[]> {
    let userNotifications = notifications.filter((n) => n.user_id === userId)
    if (unreadOnly) {
      userNotifications = userNotifications.filter((n) => !n.is_read)
    }
    return userNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  async markAsRead(notificationId: string): Promise<Notification | null> {
    const notification = notifications.find((n) => n.id === notificationId)
    if (!notification) return null

    notification.is_read = true
    notification.read_at = new Date().toISOString()
    return notification
  }

  async markAllAsRead(userId: string): Promise<number> {
    let count = 0
    for (const notification of notifications) {
      if (notification.user_id === userId && !notification.is_read) {
        notification.is_read = true
        notification.read_at = new Date().toISOString()
        count++
      }
    }
    return count
  }

  async getUnreadCount(userId: string): Promise<number> {
    return notifications.filter((n) => n.user_id === userId && !n.is_read).length
  }

  getDefaultPreferences(userId: string): NotificationPreferences {
    return { ...defaultPreferences, user_id: userId }
  }
}

export const notificationService = NotificationService.getInstance()
