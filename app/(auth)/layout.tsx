"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Warehouse } from "@/components/icons"
import { ErrorBoundary } from "@/components/error-boundary"
import { formatNumber } from "@/lib/utils/format"

interface PlatformStats {
  warehouseCount: number
  cityCount: number
}

// Format stats with thresholds: 50+, 100+, 250+, 500+, 1000+, 2500+, 5000+, 10000+
// Below threshold shows exact number
function formatStatWithThreshold(value: number): string {
  if (value <= 0) return '—'
  
  const thresholds = [10000, 5000, 2500, 1000, 500, 250, 100, 50]
  
  for (const threshold of thresholds) {
    if (value >= threshold) {
      return `${formatNumber(threshold)}+`
    }
  }
  
  // Below 50, show exact number
  return value.toString()
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isRegisterPage = pathname === '/register'
  
  // Platform stats state
  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    warehouseCount: 0,
    cityCount: 0,
  })

  // Fetch platform stats
  useEffect(() => {
    async function fetchPlatformStats() {
      try {
        const response = await fetch('/api/v1/platform/stats')
        const result = await response.json()
        if (result.success && result.data) {
          setPlatformStats(result.data)
        }
      } catch (error) {
        console.error('Failed to fetch platform stats:', error)
      }
    }
    fetchPlatformStats()
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/20">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Warehouse className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-bold">Warebnb</span>
            </Link>

            {/* Login link for register page, Register link for login page */}
            <div className="flex items-center gap-4">
              {isRegisterPage ? (
                <Link 
                  href="/login"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Already have an account? <span className="text-primary font-semibold">Sign in</span>
                </Link>
              ) : (
                <Link 
                  href="/register"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Don&apos;t have an account? <span className="text-primary font-semibold">Sign up</span>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center py-8 px-4">
          {isRegisterPage ? (
            // Register page - full width content
            <div className="w-full max-w-6xl mx-auto">
              {children}
            </div>
          ) : (
            // Login page - centered card with branding
            <div className="w-full max-w-5xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left side - Branding (desktop only) */}
              <div className="hidden lg:block">
                <div className="space-y-6">
                  <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-3">
                      Welcome back to <span className="text-primary">Warebnb</span>
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      The leading marketplace for warehouse space. Discover and book storage from verified owners across multiple locations.
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-6 pt-4">
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                      <div className="text-3xl font-bold text-primary">
                        {formatStatWithThreshold(platformStats.warehouseCount)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Warehouses</div>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <div className="text-3xl font-bold text-emerald-600">
                        {formatStatWithThreshold(platformStats.cityCount)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Cities</div>
                    </div>
                    <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                      <div className="text-3xl font-bold text-purple-600">24/7</div>
                      <div className="text-sm text-muted-foreground mt-1">Support</div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-3 pt-4">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span>Verified warehouse partners</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <span>Secure payments & contracts</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <span>Instant booking confirmation</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side - Auth form */}
              <div className="w-full max-w-md mx-auto lg:mx-0">
                {children}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="py-6 border-t bg-muted/30">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Warebnb. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/help" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Help
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
