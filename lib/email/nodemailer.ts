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
    const smtpFromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@Warebnb.com'
    const smtpFromName = process.env.SMTP_FROM_NAME || 'Warebnb'

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
      connectionTimeout: 10000, // 10 seconds timeout for connection
      greetingTimeout: 10000, // 10 seconds timeout for greeting
      socketTimeout: 10000, // 10 seconds timeout for socket
    })

    // Verify connection with timeout
    try {
      const verifyPromise = transporter.verify()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SMTP verification timeout')), 5000)
      )
      await Promise.race([verifyPromise, timeoutPromise])
      console.log('SMTP connection verified successfully')
    } catch (verifyError) {
      console.error('SMTP connection verification failed:', verifyError)
      // Don't fail completely, try to send anyway
      console.warn('Continuing with email send despite verification failure...')
    }

    // Send email with timeout
    console.log('Attempting to send email to:', options.to)
    console.log('Email subject:', options.subject)
    
    // Generate Message-ID
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 9)}@${smtpFromEmail.split('@')[1] || 'Warebnb.com'}>`
    
    const sendPromise = transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      // Headers to prevent spam
      headers: {
        'Message-ID': messageId,
        'List-Unsubscribe': `<mailto:${smtpFromEmail}?subject=Unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Importance': 'normal',
        'X-Mailer': 'Warebnb',
      },
      // Add reply-to
      replyTo: smtpFromEmail,
      // Priority
      priority: 'normal',
    })
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email send timeout after 15 seconds')), 15000)
    )
    
    const info = await Promise.race([sendPromise, timeoutPromise]) as any

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

