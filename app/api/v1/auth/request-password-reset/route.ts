import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/kolaybase/server"
import { sendEmail } from "@/lib/email/nodemailer"
import { getPasswordResetEmailTemplate } from "@/lib/email/templates/password-reset"
import type { ApiResponse, ErrorResponse } from "@/types/api"
import { randomBytes } from "crypto"

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invalid email address",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, status, email, name')
      .eq('email', email.toLowerCase())
      .single()

    if (profileError || !profile) {
      const responseData: ApiResponse = {
        success: true,
        message: "If an account with this email exists, you will receive a password reset link.",
      }
      return NextResponse.json(responseData)
    }

    if (profile.status !== true) {
      const responseData: ApiResponse = {
        success: true,
        message: "If an account with this email exists, you will receive a password reset link.",
      }
      return NextResponse.json(responseData)
    }

    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
    if (!siteUrl) {
      if (process.env.VERCEL_URL) {
        siteUrl = `https://${process.env.VERCEL_URL}`
      } else {
        siteUrl = 'http://localhost:3000'
      }
    }
    const redirectUrl = `${siteUrl}/reset-password`

    // Generate a custom password reset token (basefyio doesn't support generateLink)
    const resetToken = randomBytes(32).toString('hex')
    const tokenExpiry = new Date()
    tokenExpiry.setHours(tokenExpiry.getHours() + 1)

    const { error: tokenError } = await supabase
      .from('profiles')
      .update({
        invitation_token: resetToken,
        invitation_expires_at: tokenExpiry.toISOString(),
      })
      .eq('id', profile.id)

    if (tokenError) {
      console.error('Error storing reset token:', tokenError)
      const responseData: ApiResponse = {
        success: true,
        message: "If an account with this email exists, you will receive a password reset link.",
      }
      return NextResponse.json(responseData)
    }

    const profileName = profile.name || undefined
    const resetUrl = `${redirectUrl}?token=${resetToken}&email=${encodeURIComponent(email)}`

    const emailTemplate = getPasswordResetEmailTemplate(resetUrl, profileName)

    sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    }).catch((error) => {
      console.error('Error sending email via nodemailer (async):', error)
    })

    const responseData: ApiResponse = {
      success: true,
      message: "If an account with this email exists, you will receive a password reset link.",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Password reset request error:', error)
    const responseData: ApiResponse = {
      success: true,
      message: "If an account with this email exists, you will receive a password reset link.",
    }
    return NextResponse.json(responseData)
  }
}
