import type React from "react"
import Link from "next/link"
import { Warehouse, ArrowLeft } from "@/components/icons"
import { ErrorBoundary } from "@/components/error-boundary"

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <Warehouse className="h-6 w-6 text-primary" />
              <span className="font-bold">TSmart Warehouse</span>
            </Link>
            <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
        </header>
        <main className="container mx-auto py-12 px-4">{children}</main>
        <footer className="border-t py-6">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground">
              <div className="flex gap-6">
                <Link href="/admin" className="hover:text-foreground">
                  Admin
                </Link>
              </div>
              <div className="text-center">
                &copy; {new Date().getFullYear()} TSmart Warehouse. All rights reserved.
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
