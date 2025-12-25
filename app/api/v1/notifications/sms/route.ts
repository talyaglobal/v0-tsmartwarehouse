/**
 * SMS Notification API Endpoint
 * POST /api/v1/notifications/sms
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { NetGSMProvider } from "@/lib/notifications/providers/sms"
import { z } from "zod"

// Validation schema for single SMS
const singleSMSSchema = z.object({
  to: z.string().min(10, "Phone number must be at least 10 digits"),
  message: z.string().min(1, "Message cannot be empty").max(160, "Message too long (max 160 characters)"),
  from: z.string().optional(),
})

// Validation schema for bulk SMS
const bulkSMSSchema = z.object({
  messages: z.array(
    z.object({
      to: z.string().min(10, "Phone number must be at least 10 digits"),
      message: z.string().min(1, "Message cannot be empty").max(160, "Message too long (max 160 characters)"),
    })
  ).min(1, "At least one message is required").max(100, "Maximum 100 messages per request"),
  from: z.string().optional(),
})

/**
 * POST /api/v1/notifications/sms
 * Send SMS notification(s)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user has admin role (only admins can send SMS)
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Only admins can send SMS notifications" },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()

    // Initialize SMS provider
    const smsProvider = new NetGSMProvider()

    // Check if it's a bulk request
    if (body.messages && Array.isArray(body.messages)) {
      // Validate bulk SMS request
      const validationResult = bulkSMSSchema.safeParse(body)
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: "Validation failed",
            details: validationResult.error.errors,
          },
          { status: 400 }
        )
      }

      const { messages, from } = validationResult.data

      // Send bulk SMS
      const result = await smsProvider.sendBulk({ messages, from })

      // Log the SMS send attempt
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

      if (!result.success) {
        return NextResponse.json(
          {
            error: "Failed to send SMS",
            details: result.error,
            results: result.results,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: "Bulk SMS sent successfully",
        results: result.results,
      })
    } else {
      // Validate single SMS request
      const validationResult = singleSMSSchema.safeParse(body)
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: "Validation failed",
            details: validationResult.error.errors,
          },
          { status: 400 }
        )
      }

      const { to, message, from } = validationResult.data

      // Send single SMS
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

      if (!result.success) {
        return NextResponse.json(
          {
            error: "Failed to send SMS",
            details: result.error,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: "SMS sent successfully",
        messageId: result.messageId,
      })
    }
  } catch (error) {
    console.error("SMS API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

