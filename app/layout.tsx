import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/components/auth/auth-provider'
import { ErrorBoundaryWrapper } from '@/components/error-boundary-wrapper'
import { ToastContainer } from '@/components/ui/toast'
import { QueryProvider } from '@/lib/providers/query-provider'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'TSmart Warehouse',
  description: 'Professional Warehouse Management System',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: '32x32',
      },
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} overflow-x-hidden`}>
      <body className={`font-sans antialiased m-0 p-0 overflow-x-hidden`}>
        <ErrorBoundaryWrapper>
          <QueryProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </QueryProvider>
        </ErrorBoundaryWrapper>
        <ToastContainer />
        <Analytics />
      </body>
    </html>
  )
}
