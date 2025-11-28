import type React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { WorkerBottomNav } from "@/components/worker/bottom-nav"

export const metadata = {
  title: "TSmart Worker",
  description: "TSmart Warehouse Worker App",
  manifest: "/manifest.json",
  themeColor: "#0f172a",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <div className="flex min-h-screen flex-col bg-background pb-16">
        {children}
        <WorkerBottomNav />
      </div>
    </ThemeProvider>
  )
}
