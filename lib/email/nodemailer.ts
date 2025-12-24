import nodemailer from 'nodemailer'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587
    const smtpSecure = process.env.SMTP_SECURE === 'true'
    const smtpUser = process.env.SMTP_USER
    const smtpPassword = process.env.SMTP_PASSWORD
    const smtpFromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@tsmartwarehouse.com'
    const smtpFromName = process.env.SMTP_FROM_NAME || 'tsmartWarehouse'

    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.error('SMTP configuration is missing')
      return {
        success: false,
        error: 'SMTP configuration is missing',
      }
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })

    // Verify connection
    await transporter.verify()

    // Send email
    const info = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    })

    console.log('Email sent successfully:', info.messageId)
    return { success: true }
  } catch (error) {
    console.error('Error sending email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

