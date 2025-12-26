import type React from "react"
import { redirect } from "next/navigation"
import { BottomNav } from "@/components/worker/bottom-nav"
import { WorkerHeader } from "@/components/worker/worker-header"
import { requireRole } from "@/lib/auth/utils"
import { ErrorBoundary } from "@/components/error-boundary"
import { TopLoadingBar } from "@/components/ui/top-loading-bar"

// Force dynamic rendering - requires authentication
export const dynamic = 'force-dynamic'

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Require warehouse_staff role
  try {
    await requireRole('warehouse_staff')
  } catch (error) {
    redirect('/dashboard')
  }

  return (
    <ErrorBoundary>
      <TopLoadingBar />
      <div className="flex flex-col min-h-screen bg-background">
        <WorkerHeader />
        <main className="flex-1 pb-20 overflow-y-auto">{children}</main>
        <BottomNav />
      </div>
    </ErrorBoundary>
  )
}
