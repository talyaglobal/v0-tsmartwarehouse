/**
 * Error logging and monitoring utilities
 * Supports console logging and external services (Sentry, etc.)
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  [key: string]: unknown
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isProduction = process.env.NODE_ENV === 'production'

  /**
   * Log a message with context
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      message,
      ...(context && { context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    }

    // Console logging (always enabled)
    if (this.isDevelopment) {
      const consoleMethod = level === LogLevel.ERROR ? console.error : 
                           level === LogLevel.WARN ? console.warn :
                           level === LogLevel.INFO ? console.info : console.debug
      consoleMethod(`[${level.toUpperCase()}]`, message, context || '', error || '')
    } else {
      // In production, use structured logging
      console.log(JSON.stringify(logEntry))
    }

    // External logging services (Sentry, etc.)
    if (this.isProduction && level === LogLevel.ERROR && error) {
      this.logToExternalService(level, message, context, error)
    }
  }

  /**
   * Log to external service (Sentry, etc.)
   */
  private logToExternalService(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    // Sentry integration
    if (process.env.SENTRY_DSN && typeof window === 'undefined') {
      // Dynamic import to avoid bundling Sentry in client
      import('@sentry/nextjs').then((Sentry: any) => {
        if (error) {
          Sentry.captureException(error, {
            level: level as any,
            tags: context,
            extra: { message },
          })
        } else {
          Sentry.captureMessage(message, {
            level: level as any,
            tags: context,
          })
        }
      }).catch(() => {
        // Sentry not installed or failed to load
      })
    }
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context, error)
  }
}

// Export singleton instance
export const logger = new Logger()

/**
 * API error response helper
 */
export interface ApiError {
  message: string
  code?: string
  statusCode: number
  context?: LogContext
}

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public context?: LogContext
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Handle API errors consistently
 */
export function handleApiError(error: unknown, context?: LogContext): {
  statusCode: number
  message: string
  code?: string
} {
  if (error instanceof AppError) {
    logger.error(error.message, error, { ...context, code: error.code })
    return {
      statusCode: error.statusCode,
      message: error.message,
      code: error.code,
    }
  }

  if (error instanceof Error) {
    logger.error('Unhandled error', error, context)
    return {
      statusCode: 500,
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
    }
  }

  logger.error('Unknown error', new Error(String(error)), context)
  return {
    statusCode: 500,
    message: 'Internal server error',
  }
}

