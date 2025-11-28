import { NextResponse, type NextRequest } from "next/server"
import { getSecurityHeaders } from "@/lib/security/headers"

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add security headers
  const securityHeaders = getSecurityHeaders()
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }

  // Add correlation ID for distributed tracing
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID()
  const requestId = crypto.randomUUID()

  response.headers.set("x-correlation-id", correlationId)
  response.headers.set("x-request-id", requestId)

  // Protected routes - simplified for demo (no Supabase)
  const protectedPaths = ["/dashboard", "/admin", "/worker", "/bookings"]
  const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  // For demo purposes, allow access to all routes
  // In production, implement proper auth checks here
  if (isProtectedPath) {
    // Check for demo auth cookie or session
    const hasSession = request.cookies.get("demo-session")
    if (!hasSession) {
      // For now, set a demo session cookie
      response.cookies.set("demo-session", "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 week
      })
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
