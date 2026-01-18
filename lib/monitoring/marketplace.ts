/**
 * Marketplace-specific error tracking and monitoring
 * 
 * Provides structured logging and error tracking for marketplace features
 */

import * as Sentry from '@sentry/nextjs'

interface SearchQueryLog {
  params: {
    city?: string
    type?: string
    quantity?: number
    startDate?: string
    endDate?: string
    filters?: Record<string, any>
  }
  resultCount: number
  duration: number
  error?: string
}

interface ListingViewLog {
  warehouseId: string
  userId?: string
  source: 'search' | 'direct' | 'favorite'
  duration?: number
}

/**
 * Log search query for analytics and debugging
 */
export function logSearchQuery(log: SearchQueryLog) {
  try {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
    }

    // Track in Sentry for production monitoring
    if (process.env.NODE_ENV === 'production') {
      Sentry.addBreadcrumb({
        category: 'marketplace.search',
        message: 'Warehouse search query',
        level: log.error ? 'error' : 'info',
        data: {
          params: log.params,
          resultCount: log.resultCount,
          duration: log.duration,
        },
      })

      if (log.error) {
        Sentry.captureMessage('Warehouse search error', {
          level: 'error',
          tags: {
            feature: 'marketplace',
            component: 'search',
          },
          extra: {
            params: log.params,
            error: log.error,
          },
        })
      }
    }
  } catch (error) {
    // Silently fail - don't break the app if logging fails
    console.error('[Marketplace] Failed to log search query:', error)
  }
}

/**
 * Log warehouse listing view
 */
export function logListingView(log: ListingViewLog) {
  try {
    if (process.env.NODE_ENV === 'development') {
    }

    if (process.env.NODE_ENV === 'production') {
      Sentry.addBreadcrumb({
        category: 'marketplace.listing',
        message: 'Warehouse listing viewed',
        level: 'info',
        data: {
          warehouseId: log.warehouseId,
          userId: log.userId,
          source: log.source,
        },
      })
    }
  } catch (error) {
    console.error('[Marketplace] Failed to log listing view:', error)
  }
}

/**
 * Log booking request creation
 */
export function logBookingRequest(warehouseId: string, bookingId: string, error?: string) {
  try {
    if (process.env.NODE_ENV === 'development') {
    }

    if (process.env.NODE_ENV === 'production') {
      Sentry.addBreadcrumb({
        category: 'marketplace.booking',
        message: error ? 'Booking request failed' : 'Booking request created',
        level: error ? 'error' : 'info',
        data: {
          warehouseId,
          bookingId,
          error,
        },
      })

      if (error) {
        Sentry.captureMessage('Booking request error', {
          level: 'error',
          tags: {
            feature: 'marketplace',
            component: 'booking',
          },
          extra: {
            warehouseId,
            bookingId,
            error,
          },
        })
      }
    }
  } catch (error) {
    console.error('[Marketplace] Failed to log booking request:', error)
  }
}

/**
 * Log listing creation/update
 */
export function logListingAction(
  action: 'create' | 'update' | 'delete',
  warehouseId: string,
  success: boolean,
  error?: string
) {
  try {
    if (process.env.NODE_ENV === 'development') {
    }

    if (process.env.NODE_ENV === 'production') {
      Sentry.addBreadcrumb({
        category: 'marketplace.listing',
        message: `Listing ${action} ${success ? 'succeeded' : 'failed'}`,
        level: success ? 'info' : 'error',
        data: {
          action,
          warehouseId,
          error,
        },
      })

      if (!success && error) {
        Sentry.captureMessage(`Listing ${action} error`, {
          level: 'error',
          tags: {
            feature: 'marketplace',
            component: 'listing',
            action,
          },
          extra: {
            warehouseId,
            error,
          },
        })
      }
    }
  } catch (error) {
    console.error('[Marketplace] Failed to log listing action:', error)
  }
}

/**
 * Capture and report marketplace errors
 */
export function captureMarketplaceError(
  error: Error | string,
  context: {
    feature: string
    component: string
    [key: string]: any
  }
) {
  try {
    const errorMessage = typeof error === 'string' ? error : error.message
    const errorStack = typeof error === 'string' ? undefined : error.stack

    if (process.env.NODE_ENV === 'development') {
      console.error('[Marketplace Error]', {
        message: errorMessage,
        context,
        stack: errorStack,
      })
    }

    if (process.env.NODE_ENV === 'production') {
      const { feature: _feature, ...restContext } = context
      Sentry.captureException(typeof error === 'string' ? new Error(error) : error, {
        tags: {
          feature: 'marketplace',
          ...restContext,
        },
        extra: {
          ...context,
        },
      })
    }
  } catch (logError) {
    // Silently fail - don't break the app if error logging fails
    console.error('[Marketplace] Failed to capture error:', logError)
  }
}

