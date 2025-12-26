import type React from "react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminHeader } from "@/components/admin/admin-header"
import { ErrorBoundary } from "@/components/error-boundary"

// Force dynamic rendering - requires authentication
export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Note: Role-based access control is handled by middleware
  // Middleware will redirect users without root role before they reach this layout
  // This prevents redirect loops between layout and middleware

  return (
    <ErrorBoundary>
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <AdminSidebar />
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminHeader />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
        </div>
      </div>
    </ErrorBoundary>
  )
}
