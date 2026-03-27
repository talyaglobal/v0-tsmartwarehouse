import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-middleware";
import { getCheckoutRequestById, markCheckoutRequestCompleted } from "@/lib/db/checkout-requests";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/utils/logger";
import type { ErrorResponse } from "@/types/api";
import { z } from "zod";

const bodySchema = z.object({
  checkout_request_id: z.string().uuid(),
  photos: z.object({
    before_exit: z.string().min(1),
    loading: z.string().min(1),
    empty_area: z.string().min(1),
  }),
});

/**
 * POST /api/v1/inventory/check-out
 * Complete pallet check-out: require paid checkout request, 3 photos, then mark pallets shipped and log.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid body",
          statusCode: 400,
          details: JSON.stringify(parsed.error.flatten()),
        } satisfies ErrorResponse,
        { status: 400 }
      );
    }

    const { checkout_request_id, photos } = parsed.data;
    const req = await getCheckoutRequestById(checkout_request_id);
    if (!req) {
      return NextResponse.json(
        {
          success: false,
          error: "Checkout request not found",
          statusCode: 404,
        } satisfies ErrorResponse,
        { status: 404 }
      );
    }
    if (req.status !== "paid") {
      return NextResponse.json(
        {
          success: false,
          error: "Payment required before check-out",
          statusCode: 402,
        } satisfies ErrorResponse,
        { status: 402 }
      );
    }

    const supabase = createServerSupabaseClient();
    const { data: staff } = await supabase
      .from("warehouse_staff")
      .select("user_id")
      .eq("warehouse_id", req.warehouseId)
      .eq("user_id", user.id)
      .eq("status", true)
      .maybeSingle();
    const { data: wh } = await supabase
      .from("warehouses")
      .select("owner_company_id")
      .eq("id", req.warehouseId)
      .single();
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();
    const isCompanyAdmin = wh?.owner_company_id && profile?.company_id === wh.owner_company_id;
    if (!staff && !isCompanyAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden", statusCode: 403 } satisfies ErrorResponse,
        { status: 403 }
      );
    }

    // Sort pallet IDs consistently before locking to prevent deadlock when
    // concurrent requests overlap on different subsets of pallets.
    const palletIds = ((req.metadata?.pallet_ids as string[] | undefined) ?? []).slice().sort();

    if (palletIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No pallets linked to this checkout request",
          statusCode: 400,
        } satisfies ErrorResponse,
        { status: 400 }
      );
    }

    // Acquire checkout locks before any writes.
    // lock_pallets_for_checkout uses row-level UPDATEs with a stale-lock
    // expiry of 30 minutes, providing safety against abandoned operations.
    const { data: lockResult, error: lockError } = await supabase
      .rpc("lock_pallets_for_checkout", {
        p_inventory_item_ids: palletIds,
        p_locked_by: user.id,
      })
      .single();

    if (lockError) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to acquire pallet locks",
          statusCode: 500,
        } satisfies ErrorResponse,
        { status: 500 }
      );
    }

    const lockData = lockResult as { locked_count: number; failed_items: string[] } | null;
    if (lockData && lockData.failed_items && lockData.failed_items.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "One or more pallets are already locked for checkout by another request",
          statusCode: 409,
          details: JSON.stringify({ failed_items: lockData.failed_items }),
        } satisfies ErrorResponse,
        { status: 409 }
      );
    }

    try {
      for (const [photoType, storagePath] of Object.entries(photos)) {
        await supabase.from("pallet_checkout_photos").insert({
          pallet_checkout_request_id: checkout_request_id,
          photo_type: photoType,
          storage_path: storagePath,
          uploaded_by: user.id,
        });
      }

      const now = new Date().toISOString();
      for (const itemId of palletIds) {
        const { data: item } = await supabase
          .from("inventory_items")
          .select("id, booking_id, warehouse_id")
          .eq("id", itemId)
          .single();
        if (!item) continue;

        await supabase
          .from("inventory_items")
          .update({
            inventory_item_status: "shipped",
            shipped_at: now,
            // Clear the lock now that the row is permanently marked shipped
            checkout_locked_at: null,
            checkout_locked_by: null,
          })
          .eq("id", itemId);

        await supabase.from("pallet_operation_logs").insert({
          inventory_item_id: itemId,
          booking_id: item.booking_id,
          warehouse_id: item.warehouse_id,
          operation: "check_out",
          performed_by: user.id,
          performed_at: now,
          metadata: { checkout_request_id },
        });
      }

      await markCheckoutRequestCompleted(checkout_request_id);
    } catch (checkoutErr) {
      // Release locks if the checkout fails so the request can be retried
      await supabase.rpc("release_pallet_locks", { p_inventory_item_ids: palletIds });
      throw checkoutErr;
    }

    return NextResponse.json({
      success: true,
      data: { checkout_request_id, pallets_processed: palletIds.length },
    });
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/inventory/check-out" });
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    );
  }
}
