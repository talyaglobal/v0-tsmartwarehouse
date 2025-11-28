import type React from "react"
import Link from "next/link"
import { Warehouse } from "@/components/icons"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-foreground rounded-lg flex items-center justify-center">
            <Warehouse className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xl font-semibold text-primary-foreground">T Smart Warehouse</span>
        </Link>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight">
            Professional warehouse management made simple
          </h1>
          <p className="text-primary-foreground/80 text-lg">
            Self-service booking, real-time tracking, and enterprise-grade tools for your storage needs.
          </p>
          <div className="grid grid-cols-2 gap-6 pt-4">
            <div>
              <div className="text-3xl font-bold text-primary-foreground">1.2M</div>
              <div className="text-sm text-primary-foreground/70">Sq Ft Facility</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-foreground">1,000</div>
              <div className="text-sm text-primary-foreground/70">Pallet Capacity</div>
            </div>
          </div>
        </div>

        <p className="text-sm text-primary-foreground/60">Elizabeth, NJ • 5 miles from NJ Port</p>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <Warehouse className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">T Smart Warehouse</span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
