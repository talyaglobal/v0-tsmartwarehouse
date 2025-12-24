import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import { sendEmail } from "@/lib/email/nodemailer"
import { getPasswordResetEmailTemplate } from "@/lib/email/templates/password-reset"
import type { ApiResponse, ErrorResponse } from "@/types/api"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Email is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invalid email address",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    
    // Check if user exists
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      // Don't reveal if email exists or not for security
      // Return success anyway
      const responseData: ApiResponse = {
        success: true,
        message: "If an account with this email exists, you will receive a password reset link.",
      }
      return NextResponse.json(responseData)
    }

    const user = users.users.find(u => u.email === email)
    
    if (!user) {
      // Don't reveal if email exists or not for security
      // Return success anyway
      const responseData: ApiResponse = {
        success: true,
        message: "If an account with this email exists, you will receive a password reset link.",
      }
      return NextResponse.json(responseData)
    }

    // Generate password reset token using Supabase Admin API
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'
    const redirectUrl = `${siteUrl}/reset-password`

    // Generate recovery token using Supabase Admin API
    // This creates a recovery token without sending email
    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectUrl,
      },
    })

    if (recoveryError || !recoveryData) {
      console.error('Error generating recovery link:', recoveryError)
      // For security, don't reveal the error
      // Return success anyway
      const responseData: ApiResponse = {
        success: true,
        message: "If an account with this email exists, you will receive a password reset link.",
      }
      return NextResponse.json(responseData)
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    // Extract the recovery URL from the generated link
    // The recoveryData.properties.action_link contains the full URL with token
    const resetUrl = recoveryData.properties.action_link

    // Send email using nodemailer
    const emailTemplate = getPasswordResetEmailTemplate(resetUrl, profile?.name || undefined)
    
    const emailResult = await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    })

    if (!emailResult.success) {
      console.error('Error sending email via nodemailer:', emailResult.error)
      // For security, don't reveal the error
      // Return success anyway
    }

    const responseData: ApiResponse = {
      success: true,
      message: "If an account with this email exists, you will receive a password reset link.",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/auth/request-password-reset", method: "POST" })
    // For security, don't reveal the error
    const responseData: ApiResponse = {
      success: true,
      message: "If an account with this email exists, you will receive a password reset link.",
    }
    return NextResponse.json(responseData)
  }
}

