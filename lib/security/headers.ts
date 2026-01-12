import { NextResponse } from 'next/server'

/**
 * Comprehensive security headers configuration
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string | boolean
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false
  contentTypeOptions?: boolean
  referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url'
  permissionsPolicy?: string | boolean
  strictTransportSecurity?: boolean | { maxAge: number; includeSubDomains?: boolean; preload?: boolean }
}

const defaultCSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com https://*.googleapis.com https://maps.gstatic.com", // Google Maps support
  "script-src-elem 'self' 'unsafe-inline' https://maps.googleapis.com https://*.googleapis.com https://maps.gstatic.com", // Google Maps support
  "style-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com", // Google Maps styles
  "img-src 'self' data: https: blob: https://maps.googleapis.com https://maps.gstatic.com", // Google Maps images
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.stripe.com wss://*.supabase.co https://maps.googleapis.com",
  "frame-src 'self' https://js.stripe.com https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join('; ')

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = {}
): NextResponse {
  // Content Security Policy
  if (config.contentSecurityPolicy !== false) {
    const csp = config.contentSecurityPolicy === true 
      ? defaultCSP 
      : (config.contentSecurityPolicy || defaultCSP)
    response.headers.set('Content-Security-Policy', csp)
  }

  // X-Frame-Options
  if (config.frameOptions !== false) {
    const frameOptions = config.frameOptions || 'DENY'
    response.headers.set('X-Frame-Options', frameOptions)
  }

  // X-Content-Type-Options
  if (config.contentTypeOptions !== false) {
    response.headers.set('X-Content-Type-Options', 'nosniff')
  }

  // Referrer Policy
  const referrerPolicy = config.referrerPolicy || 'strict-origin-when-cross-origin'
  response.headers.set('Referrer-Policy', referrerPolicy)

  // Permissions Policy (formerly Feature-Policy)
  if (config.permissionsPolicy !== false) {
    const permissionsPolicy = typeof config.permissionsPolicy === 'string' 
      ? config.permissionsPolicy 
      : [
          'camera=()',
          'microphone=()',
          'geolocation=()',
          'interest-cohort=()',
        ].join(', ')
    response.headers.set('Permissions-Policy', permissionsPolicy)
  }

  // Strict Transport Security (HSTS)
  if (config.strictTransportSecurity !== false) {
    const hsts = config.strictTransportSecurity === true
      ? { maxAge: 31536000, includeSubDomains: true }
      : (config.strictTransportSecurity || { maxAge: 31536000, includeSubDomains: true })
    
    let hstsValue = `max-age=${hsts.maxAge}`
    if (hsts.includeSubDomains) {
      hstsValue += '; includeSubDomains'
    }
    if (hsts.preload) {
      hstsValue += '; preload'
    }
    response.headers.set('Strict-Transport-Security', hstsValue)
  }

  // X-XSS-Protection (legacy, but still useful for older browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Remove X-Powered-By (should be in next.config.mjs, but adding here as well)
  response.headers.delete('X-Powered-By')

  return response
}

/**
 * Get security headers configuration for Next.js headers() function
 */
export function getSecurityHeadersConfig() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on'
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload'
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block'
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin'
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
        },
      ],
    },
  ]
}

