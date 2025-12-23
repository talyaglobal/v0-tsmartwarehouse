/**
 * Suspense Boundary Components
 * Reusable loading and error states for Suspense
 */

import { Suspense, type ReactNode } from 'react'
import { Loader2 } from '@/components/icons'

interface SuspenseBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  errorFallback?: ReactNode
}

/**
 * Default loading fallback
 */
export function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

/**
 * Suspense boundary with default loading state
 */
export function SuspenseBoundary({
  children,
  fallback = <DefaultLoadingFallback />,
}: SuspenseBoundaryProps) {
  return <Suspense fallback={fallback}>{children}</Suspense>
}

/**
 * Create a suspense boundary with custom loading
 */
export function createSuspenseBoundary(fallback?: ReactNode) {
  return function CustomSuspenseBoundary({ children }: { children: ReactNode }) {
    return <SuspenseBoundary fallback={fallback}>{children}</SuspenseBoundary>
  }
}

