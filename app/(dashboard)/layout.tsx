import type React from "react"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { AIAssistant } from "@/components/dashboard/ai-assistant"
import { ErrorBoundary } from "@/components/error-boundary"

// Force dynamic rendering - requires authentication
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Note: Role-based access control is handled by middleware
  // Middleware will redirect users without proper roles before they reach this layout
  // This prevents redirect loops between layout and middleware

  return (
    <ErrorBoundary>
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <DashboardSidebar />
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader />
          <div className="flex-1 flex overflow-hidden">
            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
            {/* AI Assistant - Fixed on the right */}
            <AIAssistant />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
