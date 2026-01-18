/**
 * SMS Notification Provider
 * Supports multiple SMS providers: NetGSM (primary) and Twilio (fallback)
 */

export interface SMSProvider {
  send(options: SMSOptions): Promise<SMSResult>
  sendBulk?(options: BulkSMSOptions): Promise<BulkSMSResult>
}

export interface SMSOptions {
  to: string
  message: string
  from?: string
}

export interface BulkSMSOptions {
  messages: Array<{ to: string; message: string }>
  from?: string
}

export interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface BulkSMSResult {
  success: boolean
  results: Array<{ to: string; success: boolean; messageId?: string; error?: string }>
  error?: string
}

/**
 * NetGSM SMS Provider (Turkish SMS Service)
 * API Documentation: https://www.netgsm.com.tr/dokuman/
 */
export class NetGSMProvider implements SMSProvider {
  private username: string
  private password: string
  private msgheader: string
  private apiUrl = "https://api.netgsm.com.tr/sms/rest/v2/send"

  constructor() {
    this.username = process.env.NETGSM_USERNAME || ""
    this.password = process.env.NETGSM_PASSWORD || ""
    this.msgheader = process.env.NETGSM_HEADER || "TALYA SMART"

    if (!this.username || !this.password) {
      console.warn("NetGSM credentials not configured. SMS notifications will be disabled.")
    }
  }

  /**
   * Send single SMS
   */
  async send(options: SMSOptions): Promise<SMSResult> {
    if (!this.username || !this.password) {
      return {
        success: false,
        error: "NetGSM credentials not configured",
      }
    }

    try {
      // Format phone number (remove leading 0 if present, ensure it starts with country code)
      const formattedPhone = this.formatPhoneNumber(options.to)

      const payload = {
        msgheader: options.from || this.msgheader,
        encoding: "TR", // Turkish character support
        iysfilter: "", // IYS (İleti Yönetim Sistemi) filter
        partnercode: "",
        messages: [
          {
            msg: options.message,
            no: formattedPhone,
          },
        ],
      }

      const credentials = Buffer.from(`${this.username}:${this.password}`).toString("base64")

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `NetGSM API error: ${response.status} - ${errorText}`,
        }
      }

      const data = await response.json()

      // NetGSM returns different response codes
      // 00: Success, 01: Invalid credentials, 02: Insufficient balance, etc.
      if (data.code === "00" || data.code === 0) {
        return {
          success: true,
          messageId: data.bulkid || data.jobID || String(Date.now()),
        }
      } else {
        return {
          success: false,
          error: `NetGSM error code: ${data.code} - ${this.getErrorMessage(data.code)}`,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Send bulk SMS (multiple recipients)
   */
  async sendBulk(options: BulkSMSOptions): Promise<BulkSMSResult> {
    if (!this.username || !this.password) {
      return {
        success: false,
        results: [],
        error: "NetGSM credentials not configured",
      }
    }

    try {
      // Format all phone numbers
      const messages = options.messages.map((msg) => ({
        msg: msg.message,
        no: this.formatPhoneNumber(msg.to),
      }))

      const payload = {
        msgheader: options.from || this.msgheader,
        encoding: "TR",
        iysfilter: "",
        partnercode: "",
        messages,
      }

      const credentials = Buffer.from(`${this.username}:${this.password}`).toString("base64")

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          results: [],
          error: `NetGSM API error: ${response.status} - ${errorText}`,
        }
      }

      const data = await response.json()

      if (data.code === "00" || data.code === 0) {
        // All messages sent successfully
        const results = options.messages.map((msg) => ({
          to: msg.to,
          success: true,
          messageId: data.bulkid || data.jobID || String(Date.now()),
        }))

        return {
          success: true,
          results,
        }
      } else {
        // Bulk send failed
        const results = options.messages.map((msg) => ({
          to: msg.to,
          success: false,
          error: `NetGSM error code: ${data.code} - ${this.getErrorMessage(data.code)}`,
        }))

        return {
          success: false,
          results,
          error: `NetGSM error code: ${data.code}`,
        }
      }
    } catch (error) {
      return {
        success: false,
        results: [],
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Format phone number for NetGSM
   * NetGSM expects: 5XXXXXXXXX (without country code and leading 0)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, "")

    // Remove country code if present (90 for Turkey)
    if (cleaned.startsWith("90")) {
      cleaned = cleaned.substring(2)
    }

    // Remove leading 0 if present
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1)
    }

    return cleaned
  }

  /**
   * Get human-readable error message from NetGSM error code
   */
  private getErrorMessage(code: string | number): string {
    const errorMessages: Record<string, string> = {
      "00": "Success",
      "01": "Invalid username or password",
      "02": "Insufficient balance",
      "20": "Invalid message header",
      "30": "Invalid phone number",
      "40": "Message header not defined",
      "50": "System error",
      "51": "Invalid encoding",
      "70": "Invalid parameters",
      "85": "Invalid phone number format",
    }

    return errorMessages[String(code)] || "Unknown error"
  }
}

/**
 * Twilio SMS Provider (Fallback)
 */
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

/**
 * Create SMS provider based on environment configuration
 * Priority: NetGSM (primary) -> Twilio (fallback)
 */
export function createSMSProvider(): SMSProvider | null {
  // Try NetGSM first (primary provider for Turkish market)
  const netgsmUsername = process.env.NETGSM_USERNAME
  const netgsmPassword = process.env.NETGSM_PASSWORD

  if (netgsmUsername && netgsmPassword) {
    return new NetGSMProvider()
  }

  // Fallback to Twilio
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

  if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
    return new TwilioSMSProvider()
  }

  console.warn("No SMS provider configured")
  return null
}

