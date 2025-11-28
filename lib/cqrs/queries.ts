// CQRS - Query Handlers
// Optimized read operations with caching

export interface Query<T = unknown> {
  type: string
  params: T
  metadata?: {
    userId?: string
    requestId?: string
  }
}

export interface QueryResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  cached?: boolean
  timestamp: string
}

type QueryHandler<P, R> = (query: Query<P>) => Promise<QueryResult<R>>

class QueryBus {
  private handlers: Map<string, QueryHandler<unknown, unknown>> = new Map()
  private cache: Map<string, { data: unknown; expiry: number }> = new Map()

  register<P, R>(queryType: string, handler: QueryHandler<P, R>): void {
    this.handlers.set(queryType, handler as QueryHandler<unknown, unknown>)
  }

  async execute<P, R>(query: Query<P>, cacheTtlMs?: number): Promise<QueryResult<R>> {
    const handler = this.handlers.get(query.type)
    if (!handler) {
      return {
        success: false,
        error: `No handler for query: ${query.type}`,
        timestamp: new Date().toISOString(),
      }
    }

    // Check cache
    const cacheKey = `${query.type}:${JSON.stringify(query.params)}`
    if (cacheTtlMs) {
      const cached = this.cache.get(cacheKey)
      if (cached && cached.expiry > Date.now()) {
        return {
          success: true,
          data: cached.data as R,
          cached: true,
          timestamp: new Date().toISOString(),
        }
      }
    }

    try {
      const result = (await handler(query)) as QueryResult<R>

      // Cache successful results
      if (result.success && cacheTtlMs) {
        this.cache.set(cacheKey, {
          data: result.data,
          expiry: Date.now() + cacheTtlMs,
        })
      }

      return result
    } catch (error) {
      console.error(`[QueryBus] Error executing ${query.type}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }
    }
  }

  invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      return
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }
}

export const queryBus = new QueryBus()

// Helper to create queries
export function createQuery<T>(type: string, params: T, userId?: string): Query<T> {
  return {
    type,
    params,
    metadata: {
      userId,
      requestId: crypto.randomUUID(),
    },
  }
}
