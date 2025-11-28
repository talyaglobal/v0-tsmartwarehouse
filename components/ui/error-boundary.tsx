"use client"

import type React from "react"

import { Component, type ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo)
    this.setState({ error, errorInfo })

    // In production, send to error tracking service
    // reportError(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">An unexpected error occurred. Our team has been notified.</p>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <pre className="mt-4 overflow-auto rounded bg-muted p-2 text-xs">{this.state.error.message}</pre>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={this.handleReset} variant="outline" className="w-full bg-transparent">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook-based error boundary wrapper
export function withErrorBoundary<P extends object>(Component: React.ComponentType<P>, fallback?: ReactNode) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
