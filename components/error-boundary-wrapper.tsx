"use client"

import { ErrorBoundary } from "@/components/error-boundary"

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode
}

/**
 * Client component wrapper for ErrorBoundary
 * This allows the ErrorBoundary to be used in server components
 */
export function ErrorBoundaryWrapper({ children }: ErrorBoundaryWrapperProps) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

