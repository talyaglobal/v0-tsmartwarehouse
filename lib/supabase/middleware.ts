/**
 * Next.js middleware session handler — backed by KolayBase.
 *
 * Replaces the Supabase middleware; all session validation and role-based
 * route protection logic is preserved identically.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/kolaybase/server";

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const client = createMiddlewareClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  // Public routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/terms",
    "/privacy",
  ];
  const isPublicRoute =
    publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route)) ||
    request.nextUrl.pathname === "/";

  // Redirect to login if not authenticated and trying to access a protected route
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname.startsWith("/login") ||
      request.nextUrl.pathname.startsWith("/register"))
  ) {
    const { data: profileData } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profileData?.role || (user as any).user_metadata?.role || "warehouse_client";

    const url = request.nextUrl.clone();
    if (role === "super_admin") {
      url.pathname = "/admin";
    } else if (role === "worker") {
      url.pathname = "/worker";
    } else {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  // Role-based route protection
  if (user) {
    const { data: profileData } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profileData?.role || (user as any).user_metadata?.role || "warehouse_client";
    const pathname = request.nextUrl.pathname;

    if (pathname.startsWith("/admin") && role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/worker") && role !== "worker") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/dashboard") && role === "worker") {
      const url = request.nextUrl.clone();
      url.pathname = "/worker";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
