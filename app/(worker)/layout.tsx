import type React from "react"
import { BottomNav } from "@/components/worker/bottom-nav"
import { WorkerHeader } from "@/components/worker/worker-header"

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <WorkerHeader />
      <main className="flex-1 pb-20 overflow-y-auto">{children}</main>
      <BottomNav />
    </div>
  )
}
