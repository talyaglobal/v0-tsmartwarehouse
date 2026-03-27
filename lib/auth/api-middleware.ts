/**
 * API route authentication middleware — backed by KolayBase.
 *
 * Validates the user JWT carried in the request cookies or Authorization
 * header, resolves the role from the profiles table, and returns the user
 * object (or a 401 NextResponse on failure).
 *
 * All named exports are identical to the previous Supabase version so every
 * API route continues to work without changes.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { UserRole } from "@/types";
import { createMiddlewareClient } from "@/lib/kolaybase/server";

/**
 * Get the authenticated user from the request.
 * Reads the KB / Supabase access token from request cookies.
 */
export async function getAuthUser(request: NextRequest) {
  try {
    const client = createMiddlewareClient(request);

    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      if (error) console.error("Error getting user from KolayBase:", error.message);
      return null;
    }

    // Resolve role from profiles table
    let userRole: UserRole = "warehouse_client";
    try {
      const { data: profile } = await client
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role) {
        if (profile.role === "super_admin" || profile.role === "admin") userRole = "root";
        else if (profile.role === "owner") userRole = "warehouse_admin";
        else if (profile.role === "warehouse_client") userRole = "warehouse_client";
        else if (profile.role === "member") userRole = "warehouse_client";
        else if (profile.role === "worker") userRole = "warehouse_staff";
        else if (
          [
            "root",
            "warehouse_admin",
            "warehouse_supervisor",
            "warehouse_client",
            "warehouse_staff",
            "warehouse_finder",
            "warehouse_broker",
          ].includes(profile.role)
        ) {
          userRole = profile.role as UserRole;
        }
      } else {
        // Fallback to user_metadata
        const metadataRole = (user as any).user_metadata?.role as string;
        if (metadataRole === "super_admin" || metadataRole === "admin") userRole = "root";
        else if (metadataRole === "owner") userRole = "warehouse_admin";
        else if (metadataRole === "warehouse_client") userRole = "warehouse_client";
        else if (metadataRole === "member") userRole = "warehouse_client";
        else if (metadataRole === "worker") userRole = "warehouse_staff";
        else if (
          [
            "root",
            "warehouse_admin",
            "warehouse_supervisor",
            "warehouse_client",
            "warehouse_staff",
            "warehouse_finder",
            "warehouse_broker",
          ].includes(metadataRole)
        ) {
          userRole = metadataRole as UserRole;
        }
      }
    } catch (err) {
      console.error("Error fetching profile role:", err);
    }

    return {
      id: user.id,
      email: user.email!,
      role: userRole,
    };
  } catch (error) {
    console.error("Error getting auth user:", error);
    return null;
  }
}

/** Require authentication; return 401 if not authenticated. */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    );
  }

  return { user };
}

/** Require a specific role; return 403 if the role doesn't match. */
export async function requireRole(request: NextRequest, requiredRoles: UserRole | UserRole[]) {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) return authResult;

  const { user } = authResult;
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  if (!roles.includes(user.role)) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Requires one of the following roles: ${roles.join(", ")}`,
      },
      { status: 403 }
    );
  }

  return { user };
}

/** Alias for requireAuth returning a consistent result shape. */
export async function authenticateRequest(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return { success: true, user };
}
