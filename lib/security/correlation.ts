// Request Correlation IDs and Distributed Tracing
// For observability and debugging across services

import { headers } from "next/headers"

const CORRELATION_ID_HEADER = "x-correlation-id"
const REQUEST_ID_HEADER = "x-request-id"
const TRACE_ID_HEADER = "x-trace-id"
const SPAN_ID_HEADER = "x-span-id"

export interface TraceContext {
  correlationId: string
  requestId: string
  traceId: string
  spanId: string
  parentSpanId?: string
  startTime: number
}

export async function getTraceContext(): Promise<TraceContext> {
  const headersList = await headers()
  const now = Date.now()

  return {
    correlationId: headersList.get(CORRELATION_ID_HEADER) || crypto.randomUUID(),
    requestId: headersList.get(REQUEST_ID_HEADER) || crypto.randomUUID(),
    traceId: headersList.get(TRACE_ID_HEADER) || crypto.randomUUID(),
    spanId: crypto.randomUUID().slice(0, 16),
    parentSpanId: headersList.get(SPAN_ID_HEADER) || undefined,
    startTime: now,
  }
}

export function createSpanId(): string {
  return crypto.randomUUID().slice(0, 16)
}

// Structured logging with trace context
export interface LogEntry {
  level: "debug" | "info" | "warn" | "error"
  message: string
  context?: TraceContext
  data?: Record<string, unknown>
  error?: Error
  timestamp: string
  service: string
}

class StructuredLogger {
  private service: string

  constructor(service: string) {
    this.service = service
  }

  private log(entry: Omit<LogEntry, "timestamp" | "service">): void {
    const fullEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      service: this.service,
    }

    // In production, send to logging service
    const output = JSON.stringify(fullEntry)

    switch (entry.level) {
      case "error":
        console.error(output)
        break
      case "warn":
        console.warn(output)
        break
      case "debug":
        console.debug(output)
        break
      default:
        console.log(output)
    }
  }

  debug(message: string, data?: Record<string, unknown>, context?: TraceContext): void {
    this.log({ level: "debug", message, data, context })
  }

  info(message: string, data?: Record<string, unknown>, context?: TraceContext): void {
    this.log({ level: "info", message, data, context })
  }

  warn(message: string, data?: Record<string, unknown>, context?: TraceContext): void {
    this.log({ level: "warn", message, data, context })
  }

  error(message: string, error?: Error, data?: Record<string, unknown>, context?: TraceContext): void {
    this.log({ level: "error", message, error, data, context })
  }
}

export const logger = new StructuredLogger("tsmart-warehouse")
