/**
 * Audit logging utilities
 */

import type { CreateAuditLogParams, AuditLog } from './types'
import { createAuditLog as createAuditLogDb } from '@/lib/db/audit'

/**
 * Create an audit log entry
 * Writes to the database
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<AuditLog> {
  try {
    return await createAuditLogDb(params)
  } catch (error) {
    // Fallback to in-memory log if database fails
    console.error('Failed to create audit log in database:', error)
    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      ...params,
      createdAt: new Date().toISOString(),
    }
  }
}

/**
 * Get changes between two objects
 */
export function getObjectChanges<T extends Record<string, any>>(
  oldObj: T,
  newObj: T,
  excludeKeys: string[] = ['updatedAt', 'updated_at']
): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {}
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

  for (const key of allKeys) {
    if (excludeKeys.includes(key)) continue

    const oldValue = oldObj[key]
    const newValue = newObj[key]

    // Only log if values actually changed
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = { old: oldValue, new: newValue }
    }
  }

  return changes
}

/**
 * Format audit log for display
 */
export function formatAuditAction(action: string, entity: string): string {
  return `${action} ${entity}`
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(headers: Headers): string | undefined {
  // Check various headers for IP address
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  return undefined
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(headers: Headers): string | undefined {
  return headers.get('user-agent') || undefined
}

