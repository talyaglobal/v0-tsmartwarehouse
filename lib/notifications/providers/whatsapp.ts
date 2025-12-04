/**
 * WhatsApp Notification Provider
 * Uses Twilio WhatsApp API for WhatsApp Business messages
 */

export interface WhatsAppProvider {
  send(options: WhatsAppOptions): Promise<WhatsAppResult>
}

export interface WhatsAppOptions {
  to: string // WhatsApp number in format: whatsapp:+1234567890
  message: string
  mediaUrl?: string
}

export interface WhatsAppResult {
  success: boolean
  messageId?: string
  error?: string
}

export class TwilioWhatsAppProvider implements WhatsAppProvider {
  private accountSid: string
  private authToken: string
  private fromNumber: string

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || ""
    this.authToken = process.env.TWILIO_AUTH_TOKEN || ""
    // Twilio WhatsApp sandbox number or approved WhatsApp Business number
    this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_WHATSAPP_SANDBOX || ""

    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      console.warn("Twilio WhatsApp credentials not configured. WhatsApp notifications will be disabled.")
    }
  }

  async send(options: WhatsAppOptions): Promise<WhatsAppResult> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      return {
        success: false,
        error: "Twilio WhatsApp credentials not configured",
      }
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`

      const formData = new URLSearchParams()
      // Ensure 'to' is in WhatsApp format
      const toNumber = options.to.startsWith("whatsapp:") ? options.to : `whatsapp:${options.to}`
      formData.append("To", toNumber)
      formData.append("From", this.fromNumber.startsWith("whatsapp:") ? this.fromNumber : `whatsapp:${this.fromNumber}`)
      formData.append("Body", options.message)

      if (options.mediaUrl) {
        formData.append("MediaUrl", options.mediaUrl)
      }

      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: `Twilio WhatsApp API error: ${errorData.message || response.statusText}`,
        }
      }

      const data = await response.json()

      return {
        success: true,
        messageId: data.sid,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

export function createWhatsAppProvider(): WhatsAppProvider | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_WHATSAPP_SANDBOX

  if (!accountSid || !authToken || !whatsappNumber) {
    return null
  }

  return new TwilioWhatsAppProvider()
}

