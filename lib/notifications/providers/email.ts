/**
 * Email Notification Provider
 * Supports SendGrid and AWS SES
 */

export interface EmailProvider {
  send(options: EmailOptions): Promise<EmailResult>
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  attachments?: EmailAttachment[]
}

export interface EmailAttachment {
  filename: string
  content: string | Buffer
  contentType?: string
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// SendGrid Provider
export class SendGridProvider implements EmailProvider {
  private apiKey: string
  private fromEmail: string
  private fromName: string

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || ""
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || "notifications@tsmart.com"
    this.fromName = process.env.SENDGRID_FROM_NAME || "TSmart Warehouse"

    if (!this.apiKey) {
      console.warn("SendGrid API key not configured. Email notifications will be disabled.")
    }
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "SendGrid API key not configured",
      }
    }

    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: options.to }],
              subject: options.subject,
            },
          ],
          from: {
            email: options.from || this.fromEmail,
            name: options.fromName || this.fromName,
          },
          reply_to: options.replyTo ? { email: options.replyTo } : undefined,
          content: [
            {
              type: "text/html",
              value: options.html,
            },
            ...(options.text
              ? [
                  {
                    type: "text/plain",
                    value: options.text,
                  },
                ]
              : []),
          ],
          attachments: options.attachments?.map((att) => ({
            content: typeof att.content === "string" ? att.content : att.content.toString("base64"),
            filename: att.filename,
            type: att.contentType || "application/octet-stream",
            disposition: "attachment",
          })),
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `SendGrid API error: ${response.status} ${errorText}`,
        }
      }

      const messageId = response.headers.get("x-message-id") || undefined

      return {
        success: true,
        messageId,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

// AWS SES Provider
export class AWSSESProvider implements EmailProvider {
  private region: string
  private accessKeyId: string
  private secretAccessKey: string
  private fromEmail: string

  constructor() {
    this.region = process.env.AWS_SES_REGION || "us-east-1"
    this.accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID || ""
    this.secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY || ""
    this.fromEmail = process.env.AWS_SES_FROM_EMAIL || "notifications@tsmart.com"

    if (!this.accessKeyId || !this.secretAccessKey) {
      console.warn("AWS SES credentials not configured. Email notifications will be disabled.")
    }
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.accessKeyId || !this.secretAccessKey) {
      return {
        success: false,
        error: "AWS SES credentials not configured",
      }
    }

    try {
      // AWS SES v2 API call
      const endpoint = `https://email.${this.region}.amazonaws.com/v2/email/outbound-emails`
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": this.getAWS4Signature("POST", endpoint, {}),
        },
        body: JSON.stringify({
          FromEmailAddress: options.from || this.fromEmail,
          Destination: {
            ToAddresses: [options.to],
          },
          Content: {
            Simple: {
              Subject: {
                Data: options.subject,
                Charset: "UTF-8",
              },
              Body: {
                Html: {
                  Data: options.html,
                  Charset: "UTF-8",
                },
                ...(options.text
                  ? {
                      Text: {
                        Data: options.text,
                        Charset: "UTF-8",
                      },
                    }
                  : {}),
              },
            },
          },
          ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `AWS SES API error: ${response.status} ${errorText}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        messageId: data.MessageId,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // Simplified AWS Signature V4 (for production, use AWS SDK)
  private getAWS4Signature(method: string, url: string, headers: Record<string, string>): string {
    // This is a placeholder - in production, use @aws-sdk/ses-client or proper AWS SDK
    // For now, we'll use a simplified approach
    return `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${new Date().toISOString().split("T")[0]}/${this.region}/ses/aws4_request`
  }
}

// Email Provider Factory
export function createEmailProvider(): EmailProvider | null {
  const provider = process.env.EMAIL_PROVIDER || "sendgrid"

  if (provider === "sendgrid") {
    return new SendGridProvider()
  } else if (provider === "aws-ses") {
    return new AWSSESProvider()
  }

  console.warn(`Unknown email provider: ${provider}. Email notifications will be disabled.`)
  return null
}

