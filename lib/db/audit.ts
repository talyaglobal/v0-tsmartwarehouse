/**
 * Database operations for audit logging
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { CreateAuditLogParams, AuditLog } from '@/lib/audit/types'

/**
 * Create an audit log entry in the database
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<AuditLog> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      user_id: params.userId,
      user_email: params.userEmail,
      user_name: params.userName,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId,
      changes: params.changes || null,
      metadata: params.metadata || null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw - audit logging should not break the main flow
    // Return a mock audit log for consistency
    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      ...params,
      createdAt: new Date().toISOString(),
    }
  }

  return {
    id: data.id,
    userId: data.user_id,
    userEmail: data.user_email,
    userName: data.user_name,
    action: data.action,
    entity: data.entity,
    entityId: data.entity_id,
    changes: data.changes || undefined,
    metadata: data.metadata || undefined,
    ipAddress: data.ip_address || undefined,
    userAgent: data.user_agent || undefined,
    createdAt: data.created_at,
  }
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters: {
  userId?: string
  entity?: string
  entityId?: string
  action?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
} = {}): Promise<AuditLog[]> {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.userId) {
    query = query.eq('user_id', filters.userId)
  }

  if (filters.entity) {
    query = query.eq('entity', filters.entity)
  }

  if (filters.entityId) {
    query = query.eq('entity_id', filters.entityId)
  }

  if (filters.action) {
    query = query.eq('action', filters.action)
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate)
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate)
  }

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to get audit logs:', error)
    return []
  }

  return (data || []).map((log) => ({
    id: log.id,
    userId: log.user_id,
    userEmail: log.user_email,
    userName: log.user_name,
    action: log.action,
    entity: log.entity,
    entityId: log.entity_id,
    changes: log.changes || undefined,
    metadata: log.metadata || undefined,
    ipAddress: log.ip_address || undefined,
    userAgent: log.user_agent || undefined,
    createdAt: log.created_at,
  }))
}

/**
 * Get audit log by ID
 */
export async function getAuditLogById(id: string): Promise<AuditLog | null> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    userId: data.user_id,
    userEmail: data.user_email,
    userName: data.user_name,
    action: data.action,
    entity: data.entity,
    entityId: data.entity_id,
    changes: data.changes || undefined,
    metadata: data.metadata || undefined,
    ipAddress: data.ip_address || undefined,
    userAgent: data.user_agent || undefined,
    createdAt: data.created_at,
  }
}

