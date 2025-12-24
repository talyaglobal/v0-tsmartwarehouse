/**
 * Cron job endpoint for processing email queue
 * This endpoint should be called periodically (e.g., every minute) by Vercel Cron
 */

import { NextRequest, NextResponse } from 'next/server'
import { processAllEmails } from '@/lib/notifications/email/worker'

/**
 * Verify cron secret for security
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    // If no secret is set, allow in development
    return process.env.NODE_ENV === 'development'
  }

  return authHeader === `Bearer ${cronSecret}`
}

/**
 * POST /api/cron/process-email-queue
 * Process pending and retryable emails from the queue
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Process emails (batch size: 10)
    const results = await processAllEmails(10)

    const pendingSent = results.pending.filter((r) => r.status === 'sent').length
    const pendingFailed = results.pending.filter((r) => r.status === 'failed').length
    const retryableSent = results.retryable.filter((r) => r.status === 'sent').length
    const retryableFailed = results.retryable.filter((r) => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      pending: {
        processed: results.pending.length,
        sent: pendingSent,
        failed: pendingFailed,
      },
      retryable: {
        processed: results.retryable.length,
        sent: retryableSent,
        failed: retryableFailed,
      },
    })
  } catch (error) {
    console.error('Error processing email queue:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/process-email-queue
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Email queue processor is running',
  })
}

