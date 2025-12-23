/**
 * Async Component Utilities
 * Helpers for working with async Server Components
 */

import { cache } from 'react'
import { Suspense } from 'react'
import { DefaultLoadingFallback } from './suspense-boundary'
import type { ReactNode } from 'react'

/**
 * Cache a function for the duration of a request
 * Use this to deduplicate requests in Server Components
 */
export function cached<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return cache(fn) as T
}

/**
 * Wrap an async Server Component with Suspense
 */
export function withSuspense<T extends (...args: any[]) => Promise<ReactNode>>(
  Component: T,
  fallback?: ReactNode
): T {
  return (async (...args: Parameters<T>) => {
    return (
      <Suspense fallback={fallback ?? <DefaultLoadingFallback />}>
        {await Component(...args)}
      </Suspense>
    )
  }) as T
}

