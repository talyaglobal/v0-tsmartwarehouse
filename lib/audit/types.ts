/**
 * Audit logging types and utilities
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject'
  | 'assign'
  | 'complete'

export type AuditEntity =
  | 'booking'
  | 'invoice'
  | 'claim'
  | 'incident'
  | 'task'
  | 'user'
  | 'warehouse'
  | 'system'

export interface AuditLog {
  id: string
  userId: string
  userEmail: string
  userName: string
  action: AuditAction
  entity: AuditEntity
  entityId: string
  changes?: Record<string, { old: any; new: any }>
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface CreateAuditLogParams {
  userId: string
  userEmail: string
  userName: string
  action: AuditAction
  entity: AuditEntity
  entityId: string
  changes?: Record<string, { old: any; new: any }>
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

