/**
 * Notification Server Actions
 * Server-side actions for sending notifications
 */

"use server"

import { createClient } from "@/lib/supabase/server"
import { NetGSMProvider } from "@/lib/notifications/providers/sms"
import { getNotificationService } from "@/lib/notifications"
import { revalidatePath } from "next/cache"
import type { NotificationType, NotificationChannel } from "@/types"

interface SendSMSResult {
  success: boolean
  messageId?: string
  error?: string
}

interface SendBulkSMSResult {
  success: boolean
  results: Array<{
    to: string
    success: boolean
    messageId?: string
    error?: string
  }>
  error?: string
}

/**
 * Send single SMS notification
 */
export async function sendSMS(
  to: string,
  message: string,
  from?: string
): Promise<SendSMSResult> {
  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: "Unauthorized",
      }
    }

    // Check if user has admin role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      return {
        success: false,
        error: "Forbidden: Only admins can send SMS notifications",
      }
    }

    // Validate inputs
    if (!to || to.length < 10) {
      return {
        success: false,
        error: "Invalid phone number",
      }
    }

    if (!message || message.length === 0) {
      return {
        success: false,
        error: "Message cannot be empty",
      }
    }

    if (message.length > 160) {
      return {
        success: false,
        error: "Message too long (max 160 characters)",
      }
    }

    // Send SMS
    const smsProvider = new NetGSMProvider()
    const result = await smsProvider.send({ to, message, from })

    // Log the SMS send attempt
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "sms_send",
      resource_type: "notification",
      metadata: {
        to,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      },
    })

    return result
  } catch (error) {
    console.error("Send SMS error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Send bulk SMS notifications
 */
export async function sendBulkSMS(
  messages: Array<{ to: string; message: string }>,
  from?: string
): Promise<SendBulkSMSResult> {
  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        results: [],
        error: "Unauthorized",
      }
    }

    // Check if user has admin role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      return {
        success: false,
        results: [],
        error: "Forbidden: Only admins can send SMS notifications",
      }
    }

    // Validate inputs
    if (!messages || messages.length === 0) {
      return {
        success: false,
        results: [],
        error: "No messages provided",
      }
    }

    if (messages.length > 100) {
      return {
        success: false,
        results: [],
        error: "Maximum 100 messages per request",
      }
    }

    // Validate each message
    for (const msg of messages) {
      if (!msg.to || msg.to.length < 10) {
        return {
          success: false,
          results: [],
          error: `Invalid phone number: ${msg.to}`,
        }
      }
      if (!msg.message || msg.message.length === 0) {
        return {
          success: false,
          results: [],
          error: "Message cannot be empty",
        }
      }
      if (msg.message.length > 160) {
        return {
          success: false,
          results: [],
          error: `Message too long (max 160 characters): ${msg.to}`,
        }
      }
    }

    // Send bulk SMS
    const smsProvider = new NetGSMProvider()
    const result = await smsProvider.sendBulk({ messages, from })

    // Log the bulk SMS send attempt
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "sms_bulk_send",
      resource_type: "notification",
      metadata: {
        count: messages.length,
        success: result.success,
        results: result.results,
      },
    })

    return result
  } catch (error) {
    console.error("Send bulk SMS error:", error)
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Send notification to user via multiple channels
 */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  channels: NotificationChannel[],
  title: string,
  message: string,
  metadata?: Record<string, any>
) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: "Unauthorized",
      }
    }

    // Send notification
    const notificationService = getNotificationService()
    const result = await notificationService.sendNotification({
      userId,
      type,
      channels,
      title,
      message,
      metadata,
    })

    // Revalidate notifications page
    revalidatePath("/admin/notifications")
    revalidatePath("/dashboard/notifications")

    return result
  } catch (error) {
    console.error("Send notification error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Send booking confirmation SMS
 */
export async function sendBookingConfirmationSMS(
  userId: string,
  bookingDetails: {
    bookingId: string
    warehouseName: string
    startDate: string
    endDate: string
  }
) {
  try {
    // Get user phone number
    const supabase = await createClient()
    const { data: userProfile } = await supabase
      .from("users")
      .select("phone_number, name")
      .eq("id", userId)
      .single()

    if (!userProfile?.phone_number) {
      return {
        success: false,
        error: "User phone number not found",
      }
    }

    const message = `Rezervasyon Onayı\nID: ${bookingDetails.bookingId}\nDepo: ${bookingDetails.warehouseName}\nTarih: ${bookingDetails.startDate} - ${bookingDetails.endDate}`

    return await sendSMS(userProfile.phone_number, message)
  } catch (error) {
    console.error("Send booking confirmation SMS error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Send task assignment SMS
 */
export async function sendTaskAssignmentSMS(
  userId: string,
  taskDetails: {
    taskId: string
    taskTitle: string
    dueDate: string
  }
) {
  try {
    // Get user phone number
    const supabase = await createClient()
    const { data: userProfile } = await supabase
      .from("users")
      .select("phone_number, name")
      .eq("id", userId)
      .single()

    if (!userProfile?.phone_number) {
      return {
        success: false,
        error: "User phone number not found",
      }
    }

    const message = `Yeni Görev\n${taskDetails.taskTitle}\nSon Tarih: ${taskDetails.dueDate}\nGörev ID: ${taskDetails.taskId}`

    return await sendSMS(userProfile.phone_number, message)
  } catch (error) {
    console.error("Send task assignment SMS error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Send invoice reminder SMS
 */
export async function sendInvoiceReminderSMS(
  userId: string,
  invoiceDetails: {
    invoiceNumber: string
    amount: string
    dueDate: string
  }
) {
  try {
    // Get user phone number
    const supabase = await createClient()
    const { data: userProfile } = await supabase
      .from("users")
      .select("phone_number, name")
      .eq("id", userId)
      .single()

    if (!userProfile?.phone_number) {
      return {
        success: false,
        error: "User phone number not found",
      }
    }

    const message = `Fatura Hatırlatma\nNo: ${invoiceDetails.invoiceNumber}\nTutar: ${invoiceDetails.amount} TL\nSon Ödeme: ${invoiceDetails.dueDate}`

    return await sendSMS(userProfile.phone_number, message)
  } catch (error) {
    console.error("Send invoice reminder SMS error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

