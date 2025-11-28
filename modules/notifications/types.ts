import type { NotificationType } from "../common/types"

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  is_read: boolean
  read_at?: string
  created_at: string
}

export interface NotificationPreferences {
  user_id: string
  email_enabled: boolean
  sms_enabled: boolean
  push_enabled: boolean
  whatsapp_enabled: boolean
  types: Record<NotificationType, boolean>
}

export interface SendNotificationRequest {
  user_id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  channels?: ("email" | "sms" | "push" | "whatsapp")[]
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  variables: string[]
}
