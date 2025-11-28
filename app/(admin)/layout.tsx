import type React from "react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminHeader } from "@/components/admin/admin-header"
import { ThemeProvider } from "@/components/theme-provider"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <div className="flex h-screen overflow-hidden">
        <AdminSidebar className="hidden md:flex" />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminHeader />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ThemeProvider>
  )
}
