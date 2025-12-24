/**
 * Cron job endpoint for processing notification events
 * This endpoint should be called periodically (e.g., every minute) by Vercel Cron
 */

import { NextRequest, NextResponse } from 'next/server'
import { processPendingEvents } from '@/lib/notifications/event-processor'

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
 * POST /api/cron/process-notifications
 * Process pending notification events
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

    // Process pending events (batch size: 10)
    const results = await processPendingEvents(10)

    const completed = results.filter((r) => r.status === 'completed').length
    const failed = results.filter((r) => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      processed: results.length,
      completed,
      failed,
      results,
    })
  } catch (error) {
    console.error('Error processing notification events:', error)
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
 * GET /api/cron/process-notifications
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Notification event processor is running',
  })
}

