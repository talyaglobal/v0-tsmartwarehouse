import type React from "react"
import { redirect } from "next/navigation"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminHeader } from "@/components/admin/admin-header"
import { requireRole } from "@/lib/auth/utils"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Require admin role
  try {
    await requireRole('admin')
  } catch (error) {
    redirect('/dashboard')
  }

  return (
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
  )
}
