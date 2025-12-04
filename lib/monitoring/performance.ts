/**
 * Performance Monitoring Utilities
 * Tracks and reports application performance metrics
 */

import { logger } from "@/lib/utils/logger"

export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  tags?: Record<string, string>
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private readonly maxMetrics = 1000

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, "timestamp">) {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
    }

    this.metrics.push(fullMetric)

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }

    // Log significant performance issues
    if (metric.value > 1000 && metric.unit === "ms") {
      logger.warn(`Performance warning: ${metric.name} took ${metric.value}ms`, {
        metric: metric.name,
        value: metric.value,
        unit: metric.unit,
      })
    }
  }

  /**
   * Measure execution time of an async function
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = performance.now()
    try {
      const result = await fn()
      const duration = performance.now() - start
      this.recordMetric({
        name,
        value: duration,
        unit: "ms",
        tags,
      })
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.recordMetric({
        name: `${name}_error`,
        value: duration,
        unit: "ms",
        tags: { ...tags, error: "true" },
      })
      throw error
    }
  }

  /**
   * Measure execution time of a synchronous function
   */
  measureSync<T>(
    name: string,
    fn: () => T,
    tags?: Record<string, string>
  ): T {
    const start = performance.now()
    try {
      const result = fn()
      const duration = performance.now() - start
      this.recordMetric({
        name,
        value: duration,
        unit: "ms",
        tags,
      })
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.recordMetric({
        name: `${name}_error`,
        value: duration,
        unit: "ms",
        tags: { ...tags, error: "true" },
      })
      throw error
    }
  }

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.name === name)
  }

  /**
   * Get average metric value
   */
  getAverage(name: string): number | null {
    const metrics = this.getMetrics(name)
    if (metrics.length === 0) return null

    const sum = metrics.reduce((acc, m) => acc + m.value, 0)
    return sum / metrics.length
  }

  /**
   * Get all metrics (for reporting)
   */
  getAllMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = []
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * API route performance wrapper
 */
export function withPerformanceMonitoring<T>(
  handler: () => Promise<T>,
  routeName: string
): Promise<T> {
  return performanceMonitor.measureAsync(routeName, handler, {
    type: "api_route",
  })
}

