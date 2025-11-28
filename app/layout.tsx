import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SkipLink } from "@/components/ui/skip-link"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "T Smart Warehouse | Professional Warehouse Management",
  description:
    "World-class warehouse management and booking system in Elizabeth, NJ. Floor loading warehouse services near NJ Port with real-time capacity tracking and self-service booking.",
  generator: "Next.js",
  keywords: ["warehouse", "logistics", "storage", "Elizabeth NJ", "NJ Port", "pallet storage", "container handling"],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://tsmartwarehouse.com",
    siteName: "TSmart Warehouse",
    title: "TSmart Warehouse | Enterprise Warehouse Management",
    description: "Professional warehouse management platform with real-time tracking and self-service booking.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <SkipLink />
        <ErrorBoundary>{children}</ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
