const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g

const EMAIL_BLACKLIST = [/noreply@/i, /no-reply@/i, /example\./i, /test@/i]

export function extractContactInfo(text: string): {
  emails: string[]
  phones: string[]
  confidence: number
} {
  const rawEmails = text.match(EMAIL_REGEX) || []
  const emails = rawEmails
    .map((email) => email.toLowerCase())
    .filter((email) => !EMAIL_BLACKLIST.some((pattern) => pattern.test(email)))
    .filter((email, index, arr) => arr.indexOf(email) === index)
    .slice(0, 5)

  const rawPhones = text.match(PHONE_REGEX) || []
  const phones = rawPhones
    .map(normalizePhone)
    .filter((phone): phone is string => phone !== null)
    .filter((phone, index, arr) => arr.indexOf(phone) === index)
    .slice(0, 5)

  let confidence = 0
  if (emails.length > 0) confidence += 0.4
  if (phones.length > 0) confidence += 0.4

  return { emails, phones, confidence: Math.min(confidence, 1) }
}

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return null
}

export function extractCompanyName(title: string): string {
  return (
    title
      .split(/[|\-–—]/)[0]
      .replace(/\b(home|about|contact|welcome)\b/gi, "")
      .trim() || title
  )
}
