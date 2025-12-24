/**
 * Email Worker
 * Processes emails from the queue and sends them
 */

import {
  getPendingEmails,
  getRetryableEmails,
  markEmailAsSending,
  markEmailAsSent,
  markEmailAsFailed,
  type EmailQueueItem,
} from './queue'
import { sendEmail } from '@/lib/email/nodemailer'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface ProcessedEmail {
  id: string
  status: 'sent' | 'failed'
  error?: string
}

/**
 * Process a single email from the queue
 */
export async function processEmail(email: EmailQueueItem): Promise<ProcessedEmail> {
  try {
    // Mark as sending
    await markEmailAsSending(email.id)

    // Send email
    const result = await sendEmail({
      to: email.toEmail,
      subject: email.subject,
      html: email.htmlContent,
      text: email.textContent,
    })

    if (result.success) {
      // Mark as sent
      await markEmailAsSent(email.id)
      return {
        id: email.id,
        status: 'sent',
      }
    } else {
      // Mark as failed
      await markEmailAsFailed(email.id, result.error || 'Unknown error')
      return {
        id: email.id,
        status: 'failed',
        error: result.error,
      }
    }
  } catch (error) {
    // Mark as failed
    const errorMessage = error instanceof Error ? error.message : String(error)
    await markEmailAsFailed(email.id, errorMessage).catch(() => {
      // Ignore errors when marking as failed
    })

    return {
      id: email.id,
      status: 'failed',
      error: errorMessage,
    }
  }
}

/**
 * Process pending emails
 * Returns processed emails
 */
export async function processPendingEmails(
  batchSize: number = 10
): Promise<ProcessedEmail[]> {
  // Get pending emails
  const pendingEmails = await getPendingEmails(batchSize)

  if (pendingEmails.length === 0) {
    return []
  }

  // Process each email
  const results = await Promise.allSettled(
    pendingEmails.map((email) => processEmail(email))
  )

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        id: 'unknown',
        status: 'failed' as const,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      }
    }
  })
}

/**
 * Process retryable failed emails
 * Returns processed emails
 */
export async function processRetryableEmails(
  batchSize: number = 5
): Promise<ProcessedEmail[]> {
  // Get retryable emails
  const retryableEmails = await getRetryableEmails(batchSize)

  if (retryableEmails.length === 0) {
    return []
  }

  // Reset status to pending for retry
  const supabase = await createServerSupabaseClient()
  const emailIds = retryableEmails.map((e) => e.id)

  if (emailIds.length > 0) {
    await supabase
      .from('email_queue')
      .update({ status: 'pending' })
      .in('id', emailIds)
  }

  // Process as pending emails
  return processPendingEmails(batchSize)
}

/**
 * Process all emails (pending + retryable)
 */
export async function processAllEmails(
  batchSize: number = 10
): Promise<{
  pending: ProcessedEmail[]
  retryable: ProcessedEmail[]
}> {
  const [pending, retryable] = await Promise.all([
    processPendingEmails(batchSize),
    processRetryableEmails(Math.floor(batchSize / 2)),
  ])

  return {
    pending,
    retryable,
  }
}

