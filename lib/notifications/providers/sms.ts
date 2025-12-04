/**
 * SMS Notification Provider
 * Uses Twilio for SMS delivery
 */

export interface SMSProvider {
  send(options: SMSOptions): Promise<SMSResult>
}

export interface SMSOptions {
  to: string
  message: string
  from?: string
}

export interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
}

export class TwilioSMSProvider implements SMSProvider {
  private accountSid: string
  private authToken: string
  private fromNumber: string

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || ""
    this.authToken = process.env.TWILIO_AUTH_TOKEN || ""
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || ""

    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      console.warn("Twilio credentials not configured. SMS notifications will be disabled.")
    }
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      return {
        success: false,
        error: "Twilio credentials not configured",
      }
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`

      const formData = new URLSearchParams()
      formData.append("To", options.to)
      formData.append("From", options.from || this.fromNumber)
      formData.append("Body", options.message)

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
          error: `Twilio API error: ${errorData.message || response.statusText}`,
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

export function createSMSProvider(): SMSProvider | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !phoneNumber) {
    return null
  }

  return new TwilioSMSProvider()
}

