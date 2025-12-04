/**
 * Database functions for notifications
 */

import { createClient } from "@/lib/supabase/server"
import type { Notification, NotificationType, NotificationChannel } from "@/types"

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  channel: NotificationChannel
  title: string
  message: string
  metadata?: Record<string, any>
}

export interface NotificationPreferences {
  id?: string
  userId: string
  emailEnabled?: boolean
  smsEnabled?: boolean
  pushEnabled?: boolean
  whatsappEnabled?: boolean
  typePreferences?: Record<string, Record<string, boolean>>
  emailAddress?: string
  phoneNumber?: string
  whatsappNumber?: string
}

/**
 * Create a notification record
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<Notification> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: params.userId,
      type: params.type,
      channel: params.channel,
      title: params.title,
      message: params.message,
      metadata: params.metadata || {},
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`)
  }

  return {
    id: data.id,
    userId: data.user_id,
    type: data.type,
    channel: data.channel,
    title: data.title,
    message: data.message,
    read: data.read,
    createdAt: data.created_at,
  }
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  options?: {
    limit?: number
    offset?: number
    read?: boolean
    type?: NotificationType
  }
): Promise<Notification[]> {
  const supabase = await createClient()

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (options?.read !== undefined) {
    query = query.eq("read", options.read)
  }

  if (options?.type) {
    query = query.eq("type", options.type)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to get notifications: ${error.message}`)
  }

  return (data || []).map((n) => ({
    id: n.id,
    userId: n.user_id,
    type: n.type,
    channel: n.channel,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: n.created_at,
  }))
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`)
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false)

  if (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`)
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false)

  if (error) {
    throw new Error(`Failed to get unread count: ${error.message}`)
  }

  return count || 0
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)

  if (error) {
    throw new Error(`Failed to delete notification: ${error.message}`)
  }
}

/**
 * Get user notification preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      // No preferences found, return null
      return null
    }
    throw new Error(`Failed to get notification preferences: ${error.message}`)
  }

  return {
    id: data.id,
    userId: data.user_id,
    emailEnabled: data.email_enabled,
    smsEnabled: data.sms_enabled,
    pushEnabled: data.push_enabled,
    whatsappEnabled: data.whatsapp_enabled,
    typePreferences: data.type_preferences,
    emailAddress: data.email_address,
    phoneNumber: data.phone_number,
    whatsappNumber: data.whatsapp_number,
  }
}

/**
 * Create or update notification preferences
 */
export async function upsertNotificationPreferences(
  preferences: NotificationPreferences
): Promise<NotificationPreferences> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: preferences.userId,
        email_enabled: preferences.emailEnabled,
        sms_enabled: preferences.smsEnabled,
        push_enabled: preferences.pushEnabled,
        whatsapp_enabled: preferences.whatsappEnabled,
        type_preferences: preferences.typePreferences,
        email_address: preferences.emailAddress,
        phone_number: preferences.phoneNumber,
        whatsapp_number: preferences.whatsappNumber,
      },
      {
        onConflict: "user_id",
      }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to upsert notification preferences: ${error.message}`)
  }

  return {
    id: data.id,
    userId: data.user_id,
    emailEnabled: data.email_enabled,
    smsEnabled: data.sms_enabled,
    pushEnabled: data.push_enabled,
    whatsappEnabled: data.whatsapp_enabled,
    typePreferences: data.type_preferences,
    emailAddress: data.email_address,
    phoneNumber: data.phone_number,
    whatsappNumber: data.whatsapp_number,
  }
}

