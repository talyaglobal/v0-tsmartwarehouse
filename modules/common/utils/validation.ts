// Validation utilities for common data types

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s-()]{10,}$/
  return phoneRegex.test(phone)
}

export function isValidPostalCode(postalCode: string, country = "USA"): boolean {
  const patterns: Record<string, RegExp> = {
    USA: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
    UK: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
  }
  return patterns[country]?.test(postalCode) ?? true
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

export function isValidDateString(dateString: string): boolean {
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

export function isPositiveNumber(value: number): boolean {
  return typeof value === "number" && value > 0 && isFinite(value)
}

export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

export function sanitizeString(str: string): string {
  return str.trim().replace(/[<>]/g, "")
}

export function validateRequired<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${fieldName} is required`)
  }
  return value
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export function createValidator<T>(rules: Array<(value: T) => string | null>) {
  return (value: T): ValidationResult => {
    const errors: string[] = []
    for (const rule of rules) {
      const error = rule(value)
      if (error) errors.push(error)
    }
    return { isValid: errors.length === 0, errors }
  }
}
