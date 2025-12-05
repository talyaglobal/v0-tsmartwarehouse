import type React from "react"
import Link from "next/link"
import { Warehouse } from "@/components/icons"
import { ErrorBoundary } from "@/components/error-boundary"

// Force dynamic rendering to prevent static generation issues with Supabase
export const dynamic = 'force-dynamic'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ErrorBoundary>
      <div className="min-h-screen flex">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between text-primary-foreground">
          <Link href="/" className="flex items-center gap-2">
            <Warehouse className="h-8 w-8" />
            <span className="text-xl font-bold">TSmart Warehouse</span>
          </Link>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold">Professional Warehouse Storage Solutions</h1>
            <p className="text-lg opacity-90">
              240,000 sq ft of secure, climate-controlled storage space. Flexible pallet storage and dedicated area
              rentals.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-8">
              <div>
                <div className="text-3xl font-bold">$5</div>
                <div className="text-sm opacity-80">Pallet In</div>
              </div>
              <div>
                <div className="text-3xl font-bold">$17.50</div>
                <div className="text-sm opacity-80">Per Pallet/Mo</div>
              </div>
              <div>
                <div className="text-3xl font-bold">$20</div>
                <div className="text-sm opacity-80">Sq Ft/Year</div>
              </div>
            </div>
          </div>
          <p className="text-sm opacity-70">&copy; {new Date().getFullYear()} TSmart Warehouse. All rights reserved.</p>
        </div>

        {/* Right Panel - Auth Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden mb-8 text-center">
              <Link href="/" className="inline-flex items-center gap-2">
                <Warehouse className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">TSmart Warehouse</span>
              </Link>
            </div>
            {children}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
