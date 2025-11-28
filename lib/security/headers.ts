// Security Headers - OWASP Compliant
// CSP, HSTS, X-Frame-Options, etc.

export interface SecurityHeaders {
  [key: string]: string
}

export function getSecurityHeaders(): SecurityHeaders {
  const isDev = process.env.NODE_ENV === "development"

  return {
    // Strict Transport Security - Force HTTPS
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",

    // Content Security Policy
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://vercel.live wss://ws-us3.pusher.com https://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      isDev ? "" : "upgrade-insecure-requests",
    ]
      .filter(Boolean)
      .join("; "),

    // Prevent clickjacking
    "X-Frame-Options": "DENY",

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Enable XSS filter
    "X-XSS-Protection": "1; mode=block",

    // Referrer policy
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Permissions policy
    "Permissions-Policy": ["camera=(self)", "microphone=()", "geolocation=(self)", "interest-cohort=()"].join(", "),

    // Cross-Origin policies
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "credentialless",
  }
}

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message: string
}

export const rateLimits: Record<string, RateLimitConfig> = {
  default: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: "Too many requests, please try again later.",
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: "Too many authentication attempts, please try again later.",
  },
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: "API rate limit exceeded.",
  },
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
    message: "Upload limit exceeded, please try again later.",
  },
}

// Simple in-memory rate limiter (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = rateLimits.default,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const key = identifier
  const stored = rateLimitStore.get(key)

  if (!stored || stored.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs }
  }

  if (stored.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: stored.resetAt }
  }

  stored.count++
  return { allowed: true, remaining: config.maxRequests - stored.count, resetAt: stored.resetAt }
}
