/**
 * Notification Service
 * Orchestrates sending notifications across all channels
 */

import type { NotificationType, NotificationChannel } from "@/types"
import { createEmailProvider } from "./providers/email"
import { createSMSProvider } from "./providers/sms"
import { createPushProvider } from "./providers/push"
import { createWhatsAppProvider } from "./providers/whatsapp"
import { getEmailTemplate } from "./templates/email"
import { createClient } from "@/lib/supabase/server"

export interface NotificationOptions {
  userId: string
  type: NotificationType
  channels: NotificationChannel[]
  title: string
  message: string
  template?: string
  templateData?: Record<string, any>
  metadata?: Record<string, any>
}

export interface NotificationResult {
  success: boolean
  notificationId?: string
  results: ChannelResult[]
  error?: string
}

export interface ChannelResult {
  channel: NotificationChannel
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Main notification service
 */
export class NotificationService {
  private emailProvider = createEmailProvider()
  private smsProvider = createSMSProvider()
  private pushProvider = createPushProvider()
  private whatsappProvider = createWhatsAppProvider()

  /**
   * Send notification to user across specified channels
   */
  async sendNotification(options: NotificationOptions): Promise<NotificationResult> {
    const supabase = await createClient()
    const results: ChannelResult[] = []

    try {
      // Get user notification preferences
      const preferences = await this.getUserPreferences(options.userId, supabase)

      // Filter channels based on user preferences
      const enabledChannels = this.filterEnabledChannels(
        options.channels,
        options.type,
        preferences
      )

      if (enabledChannels.length === 0) {
        return {
          success: false,
          results: [],
          error: "No enabled notification channels for user",
        }
      }

      // Get user contact information
      const userInfo = await this.getUserInfo(options.userId, supabase)

      // Create notification record in database
      const notificationId = await this.createNotificationRecord(
        options,
        supabase
      )

      // Send to each enabled channel
      for (const channel of enabledChannels) {
        const result = await this.sendToChannel(channel, options, userInfo, preferences)
        results.push(result)

        // Update notification record with delivery status
        await this.updateNotificationDelivery(
          notificationId,
          channel,
          result,
          supabase
        )
      }

      const allSuccessful = results.every((r) => r.success)
      const someSuccessful = results.some((r) => r.success)

      return {
        success: someSuccessful,
        notificationId,
        results,
        error: allSuccessful ? undefined : "Some channels failed to deliver",
      }
    } catch (error) {
      return {
        success: false,
        results,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendBulkNotification(
    userIds: string[],
    options: Omit<NotificationOptions, "userId">
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = []

    for (const userId of userIds) {
      const result = await this.sendNotification({
        ...options,
        userId,
      })
      results.push(result)
    }

    return results
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(userId: string, supabase: any) {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine (use defaults)
      console.error("Error fetching notification preferences:", error)
    }

    return data || this.getDefaultPreferences()
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences() {
    return {
      email_enabled: true,
      sms_enabled: false,
      push_enabled: true,
      whatsapp_enabled: false,
      type_preferences: {
        booking: { email: true, sms: false, push: true, whatsapp: false },
        invoice: { email: true, sms: false, push: true, whatsapp: false },
        task: { email: false, sms: false, push: true, whatsapp: false },
        incident: { email: true, sms: true, push: true, whatsapp: false },
        system: { email: true, sms: false, push: true, whatsapp: false },
      },
    }
  }

  /**
   * Filter channels based on user preferences
   */
  private filterEnabledChannels(
    requestedChannels: NotificationChannel[],
    type: NotificationType,
    preferences: any
  ): NotificationChannel[] {
    return requestedChannels.filter((channel) => {
      // Check global channel preference
      const channelKey = `${channel}_enabled` as keyof typeof preferences
      if (!preferences[channelKey]) {
        return false
      }

      // Check type-specific preference
      const typePrefs = preferences.type_preferences?.[type]
      if (typePrefs && typePrefs[channel] === false) {
        return false
      }

      return true
    })
  }

  /**
   * Get user contact information
   */
  private async getUserInfo(userId: string, supabase: any) {
    const { data, error } = await supabase
      .from("users")
      .select("email, phone_number, name")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("Error fetching user info:", error)
      return {}
    }

    // Also get from preferences if available
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("email_address, phone_number, whatsapp_number")
      .eq("user_id", userId)
      .single()

    return {
      email: prefs?.email_address || data?.email,
      phone: prefs?.phone_number || data?.phone_number,
      whatsapp: prefs?.whatsapp_number,
      name: data?.name,
    }
  }

  /**
   * Create notification record in database
   */
  private async createNotificationRecord(
    options: NotificationOptions,
    supabase: any
  ): Promise<string> {
    // For now, we'll create a record for the first channel
    // In production, you might want to create one record per channel
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: options.userId,
        type: options.type,
        channel: options.channels[0] || "email",
        title: options.title,
        message: options.message,
        metadata: options.metadata || {},
      })
      .select("id")
      .single()

    if (error) {
      console.error("Error creating notification record:", error)
      throw error
    }

    return data.id
  }

  /**
   * Update notification delivery status
   */
  private async updateNotificationDelivery(
    notificationId: string,
    channel: NotificationChannel,
    result: ChannelResult,
    supabase: any
  ) {
    const updateData: any = {
      sent_at: new Date().toISOString(),
    }

    if (result.success) {
      updateData.delivered_at = new Date().toISOString()
      updateData.metadata = { [channel]: { messageId: result.messageId } }
    } else {
      updateData.failed_at = new Date().toISOString()
      updateData.error_message = result.error
      updateData.metadata = { [channel]: { error: result.error } }
    }

    await supabase
      .from("notifications")
      .update(updateData)
      .eq("id", notificationId)
  }

  /**
   * Send notification to a specific channel
   */
  private async sendToChannel(
    channel: NotificationChannel,
    options: NotificationOptions,
    userInfo: any,
    _preferences: any
  ): Promise<ChannelResult> {
    try {
      switch (channel) {
        case "email":
          return await this.sendEmail(options, userInfo)
        case "sms":
          return await this.sendSMS(options, userInfo)
        case "push":
          return await this.sendPush(options, userInfo)
        case "whatsapp":
          return await this.sendWhatsApp(options, userInfo)
        default:
          return {
            channel,
            success: false,
            error: `Unknown channel: ${channel}`,
          }
      }
    } catch (error) {
      return {
        channel,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    options: NotificationOptions,
    userInfo: any
  ): Promise<ChannelResult> {
    if (!this.emailProvider) {
      return {
        channel: "email",
        success: false,
        error: "Email provider not configured",
      }
    }

    if (!userInfo.email) {
      return {
        channel: "email",
        success: false,
        error: "User email not found",
      }
    }

    let subject = options.title
    let html = `<p>${options.message}</p>`
    let text = options.message

    // Use template if provided
    if (options.template) {
      const template = getEmailTemplate(options.template)
      if (template) {
        const templateData = {
          ...options.templateData,
          userName: userInfo.name,
          customerName: userInfo.name,
          dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
        }
        subject = typeof template.subject === "function" ? template.subject(templateData) : template.subject
        html = template.html(templateData)
        text = template.text ? template.text(templateData) : options.message
      }
    }

    const result = await this.emailProvider.send({
      to: userInfo.email,
      subject,
      html,
      text,
    })

    return {
      channel: "email",
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(
    options: NotificationOptions,
    userInfo: any
  ): Promise<ChannelResult> {
    if (!this.smsProvider) {
      return {
        channel: "sms",
        success: false,
        error: "SMS provider not configured",
      }
    }

    if (!userInfo.phone) {
      return {
        channel: "sms",
        success: false,
        error: "User phone number not found",
      }
    }

    const result = await this.smsProvider.send({
      to: userInfo.phone,
      message: `${options.title}\n\n${options.message}`,
    })

    return {
      channel: "sms",
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    }
  }

  /**
   * Send push notification
   */
  private async sendPush(
    options: NotificationOptions,
    userInfo: any
  ): Promise<ChannelResult> {
    if (!this.pushProvider) {
      return {
        channel: "push",
        success: false,
        error: "Push provider not configured",
      }
    }

    // Get user's push subscription from database
    // This would typically be stored when user subscribes to push notifications
    // For now, we'll return an error if subscription not found
    const subscription = userInfo.pushSubscription

    if (!subscription) {
      return {
        channel: "push",
        success: false,
        error: "User push subscription not found",
      }
    }

    const result = await this.pushProvider.send({
      subscription,
      title: options.title,
      body: options.message,
      data: options.metadata,
    })

    return {
      channel: "push",
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    }
  }

  /**
   * Send WhatsApp notification
   */
  private async sendWhatsApp(
    options: NotificationOptions,
    userInfo: any
  ): Promise<ChannelResult> {
    if (!this.whatsappProvider) {
      return {
        channel: "whatsapp",
        success: false,
        error: "WhatsApp provider not configured",
      }
    }

    const whatsappNumber = userInfo.whatsapp || userInfo.phone

    if (!whatsappNumber) {
      return {
        channel: "whatsapp",
        success: false,
        error: "User WhatsApp number not found",
      }
    }

    const result = await this.whatsappProvider.send({
      to: whatsappNumber,
      message: `${options.title}\n\n${options.message}`,
    })

    return {
      channel: "whatsapp",
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    }
  }
}

// Singleton instance
let notificationServiceInstance: NotificationService | null = null

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService()
  }
  return notificationServiceInstance
}

