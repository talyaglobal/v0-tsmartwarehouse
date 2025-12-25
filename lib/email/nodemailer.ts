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
      const missingVars = []
      if (!smtpHost) missingVars.push('SMTP_HOST')
      if (!smtpUser) missingVars.push('SMTP_USER')
      if (!smtpPassword) missingVars.push('SMTP_PASSWORD')
      
      console.error('SMTP configuration is missing. Required variables:', missingVars.join(', '))
      console.error('Please set the following environment variables in .env.local:')
      console.error('  SMTP_HOST=your-smtp-host')
      console.error('  SMTP_PORT=587 (or 465 for SSL)')
      console.error('  SMTP_USER=your-smtp-username')
      console.error('  SMTP_PASSWORD=your-smtp-password')
      console.error('  SMTP_FROM_EMAIL=your-email@domain.com (optional)')
      console.error('  SMTP_FROM_NAME=Your Name (optional)')
      
      return {
        success: false,
        error: `SMTP configuration is missing. Required: ${missingVars.join(', ')}`,
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
    try {
      await transporter.verify()
      console.log('SMTP connection verified successfully')
    } catch (verifyError) {
      console.error('SMTP connection verification failed:', verifyError)
      return {
        success: false,
        error: `SMTP connection failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`,
      }
    }

    // Send email
    console.log('Attempting to send email to:', options.to)
    console.log('Email subject:', options.subject)
    
    const info = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    })

    console.log('Email sent successfully!')
    console.log('  Message ID:', info.messageId)
    console.log('  To:', options.to)
    console.log('  From:', smtpFromEmail)
    
    return { success: true }
  } catch (error) {
    console.error('Error sending email:', error)
    if (error instanceof Error) {
      console.error('  Error name:', error.name)
      console.error('  Error message:', error.message)
      if ('code' in error) {
        console.error('  Error code:', error.code)
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

