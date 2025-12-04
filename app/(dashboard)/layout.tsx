import type React from "react"
import { redirect } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { requireRole } from "@/lib/auth/utils"
import { ErrorBoundary } from "@/components/error-boundary"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Require customer or admin role
  try {
    await requireRole(['customer', 'admin'])
  } catch (error) {
    redirect('/login')
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <DashboardSidebar />
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
        </div>
      </div>
    </ErrorBoundary>
  )
}
