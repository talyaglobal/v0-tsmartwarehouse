/**
 * Email Queue
 * Manages email queue operations (add, retrieve, update)
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface EmailQueueItem {
  id: string
  toEmail: string
  subject: string
  htmlContent: string
  textContent?: string
  priority: number
  status: 'pending' | 'sending' | 'sent' | 'failed'
  retryCount: number
  maxRetries: number
  sentAt?: string
  errorMessage?: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface AddEmailToQueueOptions {
  toEmail: string
  subject: string
  htmlContent: string
  textContent?: string
  priority?: number
  metadata?: Record<string, any>
}

/**
 * Add email to queue
 */
export async function addEmailToQueue(
  options: AddEmailToQueueOptions
): Promise<string> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('email_queue')
    .insert({
      to_email: options.toEmail,
      subject: options.subject,
      html_content: options.htmlContent,
      text_content: options.textContent,
      priority: options.priority ?? 0,
      status: 'pending',
      metadata: options.metadata || {},
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to add email to queue: ${error.message}`)
  }

  return data.id
}

/**
 * Get pending emails from queue
 * Returns emails ordered by priority (highest first) and creation time
 */
export async function getPendingEmails(
  limit: number = 10
): Promise<EmailQueueItem[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to get pending emails: ${error.message}`)
  }

  return (data || []).map(mapEmailQueueItem)
}

/**
 * Get failed emails that can be retried
 */
export async function getRetryableEmails(
  limit: number = 10
): Promise<EmailQueueItem[]> {
  const supabase = await createServerSupabaseClient()

  // Get failed emails and filter in memory (since we can't use raw SQL in Supabase client)
  const { data: allFailed, error: fetchError } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'failed')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit * 2) // Get more to filter

  if (fetchError) {
    throw new Error(`Failed to get retryable emails: ${fetchError.message}`)
  }

  // Filter where retry_count < max_retries
  const data = (allFailed || []).filter(
    (item) => item.retry_count < item.max_retries
  ).slice(0, limit)

  return (data || []).map(mapEmailQueueItem)
}

/**
 * Mark email as sending
 */
export async function markEmailAsSending(emailId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('email_queue')
    .update({ status: 'sending' })
    .eq('id', emailId)

  if (error) {
    throw new Error(`Failed to mark email as sending: ${error.message}`)
  }
}

/**
 * Mark email as sent
 */
export async function markEmailAsSent(emailId: string): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('email_queue')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', emailId)

  if (error) {
    throw new Error(`Failed to mark email as sent: ${error.message}`)
  }
}

/**
 * Mark email as failed
 */
export async function markEmailAsFailed(
  emailId: string,
  errorMessage: string,
  incrementRetry: boolean = true
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  const updateData: any = {
    status: 'failed',
    error_message: errorMessage,
  }

  if (incrementRetry) {
    // Get current retry count
    const { data: email } = await supabase
      .from('email_queue')
      .select('retry_count')
      .eq('id', emailId)
      .single()

    if (email) {
      updateData.retry_count = email.retry_count + 1
    }
  }

  const { error } = await supabase
    .from('email_queue')
    .update(updateData)
    .eq('id', emailId)

  if (error) {
    throw new Error(`Failed to mark email as failed: ${error.message}`)
  }
}

/**
 * Map database row to EmailQueueItem
 */
function mapEmailQueueItem(row: any): EmailQueueItem {
  return {
    id: row.id,
    toEmail: row.to_email,
    subject: row.subject,
    htmlContent: row.html_content,
    textContent: row.text_content,
    priority: row.priority,
    status: row.status,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    sentAt: row.sent_at,
    errorMessage: row.error_message,
    metadata: row.metadata,
    createdAt: row.created_at,
  }
}

