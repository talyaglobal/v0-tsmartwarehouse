"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "@/components/icons"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Root error boundary caught an error:", error)
    }
    
    // In production, you could log to an error reporting service here
    // Example: logErrorToService(error)
  }, [error])

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                An unexpected error occurred. Please try again or return to the home page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === "development" && (
                <div className="rounded-md bg-muted p-3 space-y-2">
                  <p className="text-sm font-semibold text-destructive">Error Details:</p>
                  <p className="text-sm font-mono text-destructive break-words">
                    {error.message}
                  </p>
                  {error.digest && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Error ID: {error.digest}
                    </p>
                  )}
                  {error.stack && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        Stack Trace
                      </summary>
                      <pre className="text-xs mt-2 p-2 bg-background rounded overflow-auto max-h-40">
                        {error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={reset} variant="default" className="flex-1">
                  Try Again
                </Button>
                <Button 
                  onClick={() => window.location.href = "/"} 
                  variant="outline"
                  className="flex-1"
                >
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  )
}

