/**
 * Profile Sync API
 *
 * Syncs the Keycloak auth user ID with the profiles table.
 * Uses KolayBase REST client (no Prisma dependency).
 */
import { NextResponse } from "next/server";
import { createAuthenticatedServerClient, createServerClient } from "@/lib/kolaybase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const authClient = await createAuthenticatedServerClient();
    const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message },
        { status: 401 }
      );
    }

    const authId = authUser.id;
    const authEmail = authUser.email;

    if (!authId || !authEmail) {
      return NextResponse.json({ error: "Auth user missing id or email" }, { status: 400 });
    }

    const db = createServerClient();

    // Check if profile already matches auth ID
    const { data: existing } = await db
      .from("profiles")
      .select("id, email, role")
      .eq("id", authId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        message: "Profile already synced",
        profile: existing,
        authId,
      });
    }

    // Find profile by email
    const { data: emailProfile } = await db
      .from("profiles")
      .select("id, email, role, name")
      .eq("email", authEmail)
      .maybeSingle();

    if (!emailProfile) {
      // Create new profile
      const name = authUser.firstName
        ? `${authUser.firstName} ${authUser.lastName || ""}`.trim()
        : authEmail.split("@")[0];

      const { error: createError } = await db
        .from("profiles")
        .insert({ id: authId, email: authEmail, name, role: "warehouse_client" });

      if (createError) {
        return NextResponse.json(
          { error: "Failed to create profile", details: createError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ message: "New profile created", authId, email: authEmail });
    }

    const oldId = emailProfile.id;
    if (oldId === authId) {
      return NextResponse.json({
        message: "Profile already synced",
        profile: emailProfile,
        authId,
      });
    }

    // Update all FK references using direct REST API calls
    // Then create new profile and delete old one
    const fkUpdates: [string, string][] = [
      ["bookings", "customer_id"],
      ["bookings", "approved_by"],
      ["bookings", "booked_by"],
      ["bookings", "booked_on_behalf_of"],
      ["bookings", "created_by"],
      ["invoices", "customer_id"],
      ["payments", "customer_id"],
      ["inventory_items", "customer_id"],
      ["claims", "customer_id"],
      ["estimates", "customer_id"],
      ["service_orders", "customer_id"],
      ["warehouse_staff", "user_id"],
      ["warehouse_reviews", "user_id"],
      ["warehouse_favorites", "user_id"],
      ["worker_shifts", "worker_id"],
      ["tasks", "assigned_to"],
      ["notifications", "user_id"],
      ["notification_preferences", "user_id"],
      ["audit_logs", "user_id"],
      ["incidents", "reported_by"],
      ["conversations", "customer_id"],
      ["conversation_messages", "sender_id"],
      ["appointment_participants", "user_id"],
      ["appointment_types", "created_by"],
      ["appointments", "created_by"],
      ["client_team_members", "member_id"],
      ["client_teams", "created_by"],
      ["crm_activities", "created_by"],
      ["crm_activities", "assigned_to"],
      ["broker_customers", "customer_id"],
      ["customer_group_members", "customer_id"],
      ["warehouse_capacity_snapshots", "customer_id"],
    ];

    // Update FK references via REST API PATCH
    for (const [table, column] of fkUpdates) {
      try {
        await db
          .from(table)
          .update({ [column]: authId })
          .eq(column, oldId);
      } catch {
        // Skip tables/columns that don't exist
      }
    }

    // Create new profile with auth ID
    await db
      .from("profiles")
      .upsert({
        id: authId,
        email: emailProfile.email,
        name: emailProfile.name || "",
        role: emailProfile.role,
      }, { onConflict: "id" });

    // Delete old profile
    try {
      await db.from("profiles").delete().eq("id", oldId);
    } catch {
      // May still be referenced
    }

    return NextResponse.json({
      message: "Profile synced successfully",
      oldId,
      newId: authId,
      email: authEmail,
      role: emailProfile.role,
    });
  } catch (error: any) {
    console.error("sync-profile error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const authClient = await createAuthenticatedServerClient();
    const { data: { user: authUser }, error } = await authClient.auth.getUser();

    if (error || !authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = createServerClient();
    const { data: profile } = await db
      .from("profiles")
      .select("id, email, role, name")
      .eq("email", authUser.email)
      .maybeSingle();

    return NextResponse.json({
      authUser: { id: authUser.id, email: authUser.email },
      profile,
      synced: profile?.id === authUser.id,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
