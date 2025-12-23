"use client"

import { ErrorBoundary } from "@/components/error-boundary"

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

/**
 * Client component wrapper for ErrorBoundary
 * This allows the ErrorBoundary to be used in server components
 */
export function ErrorBoundaryWrapper({ 
  children, 
  fallback,
  onError 
}: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundary>
  )
}

