/**
 * Input sanitization utilities for XSS prevention
 */

/**
 * Sanitize HTML string to prevent XSS attacks
 * Removes potentially dangerous HTML tags and attributes
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')
  
  // Remove javascript: and data: URLs in href/src
  sanitized = sanitized.replace(/(href|src)\s*=\s*["']?\s*(javascript|data):/gi, '$1="#"')
  
  // Remove iframe, embed, object tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
  sanitized = sanitized.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
  
  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  
  // Remove dangerous attributes
  sanitized = sanitized.replace(/\s*(style|formaction|formmethod|formtarget)\s*=\s*["'][^"']*["']/gi, '')
  
  return sanitized.trim()
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }

  return text.replace(/[&<>"']/g, (char) => map[char])
}

/**
 * Sanitize user input for database queries
 * Removes SQL injection patterns (though Supabase uses parameterized queries)
 */
export function sanitizeSqlInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  // Remove SQL comment patterns
  let sanitized = input.replace(/--/g, '')
  sanitized = sanitized.replace(/\/\*/g, '')
  sanitized = sanitized.replace(/\*\//g, '')
  
  // Remove semicolons (though parameterized queries handle this)
  sanitized = sanitized.replace(/;/g, '')
  
  return sanitized.trim()
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'file'
  }

  // Remove path separators
  let sanitized = filename.replace(/[\/\\]/g, '_')
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '')
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '_')
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'))
    sanitized = sanitized.substring(0, 255 - ext.length) + ext
  }
  
  return sanitized || 'file'
}

/**
 * Sanitize URL to prevent XSS and open redirect attacks
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  try {
    const parsed = new URL(url)
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null
    }
    
    // Prevent javascript: and data: URLs
    if (url.toLowerCase().startsWith('javascript:') || url.toLowerCase().startsWith('data:')) {
      return null
    }
    
    return parsed.toString()
  } catch {
    // Invalid URL
    return null
  }
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T, options: {
  sanitizeStrings?: boolean
  sanitizeHtml?: boolean
  allowedKeys?: string[]
} = {}): T {
  const {
    sanitizeStrings = true,
    sanitizeHtml: sanitizeHtmlFields = false,
    allowedKeys,
  } = options

  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options)) as T
  }

  const sanitized = {} as T

  for (const [key, value] of Object.entries(obj)) {
    // Skip if key is not allowed
    if (allowedKeys && !allowedKeys.includes(key)) {
      continue
    }

    if (typeof value === 'string') {
      if (sanitizeHtmlFields) {
        sanitized[key as keyof T] = sanitizeHtml(value) as T[keyof T]
      } else if (sanitizeStrings) {
        sanitized[key as keyof T] = escapeHtml(value) as T[keyof T]
      } else {
        sanitized[key as keyof T] = value as T[keyof T]
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key as keyof T] = sanitizeObject(value, options) as T[keyof T]
    } else {
      sanitized[key as keyof T] = value as T[keyof T]
    }
  }

  return sanitized
}

