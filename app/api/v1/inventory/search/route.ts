import { NextRequest, NextResponse } from "next/server";
import { searchInventoryByCode } from "@/lib/db/inventory";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/utils/logger";
import { decodePalletQRPayload } from "@/lib/utils/qr-payload";

const SCAN_TYPES = ["check_in", "check_out", "move", "view"] as const;
type ScanType = (typeof SCAN_TYPES)[number];

// Operations that must be deduplicated (actionable, not just read-only views)
const ACTIONABLE_SCAN_TYPES: ScanType[] = ["check_in", "check_out", "move"];

/**
 * GET /api/v1/inventory/search
 * Search for inventory item by barcode/QR code.
 *
 * For authenticated requests:
 *  - Validates QR signature if the code is a signed QR payload
 *  - Writes to qr_scan_logs (audit trail)
 *  - Prevents duplicate actionable scans within a 1-minute debounce window
 *  - Also logs to pallet_operation_logs for backwards compat
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const scanTypeParam = searchParams.get("operation") || "view";
    const scanType: ScanType = SCAN_TYPES.includes(scanTypeParam as ScanType)
      ? (scanTypeParam as ScanType)
      : "view";

    if (!code) {
      return NextResponse.json({ error: "Code parameter is required" }, { status: 400 });
    }

    // Validate QR signature if this looks like a signed/legacy QR payload
    if (code.startsWith("{")) {
      const decoded = decodePalletQRPayload(code);
      if (decoded === null) {
        return NextResponse.json(
          { error: "Invalid or tampered QR code", statusCode: 400 },
          { status: 400 }
        );
      }
    }

    const item = await searchInventoryByCode(code);

    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && item.id && item.booking_id && item.warehouse_id) {
      const now = new Date();
      const itemId = item.id as string;
      const bookingId = item.booking_id as string;
      const warehouseId = item.warehouse_id as string;

      // Duplicate scan prevention for actionable operations.
      // The DB unique index uidx_qr_scan_no_duplicate_action covers the same
      // window; this app-level check surfaces a user-friendly error instead of
      // letting the DB throw a constraint violation.
      if (ACTIONABLE_SCAN_TYPES.includes(scanType)) {
        const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString();
        const { data: recentScan } = await supabase
          .from("qr_scan_logs")
          .select("id, scanned_at")
          .eq("inventory_item_id", itemId)
          .eq("scan_type", scanType)
          .eq("scanned_by", user.id)
          .gte("scanned_at", oneMinuteAgo)
          .limit(1)
          .maybeSingle();

        if (recentScan) {
          return NextResponse.json(
            {
              error:
                "Duplicate scan detected. This pallet was already scanned for this operation within the last minute.",
              statusCode: 409,
              duplicate: true,
            },
            { status: 409 }
          );
        }
      }

      // Write audit log to qr_scan_logs
      await supabase.from("qr_scan_logs").insert({
        inventory_item_id: itemId,
        booking_id: bookingId,
        warehouse_id: warehouseId,
        scan_type: scanType,
        scanned_by: user.id,
        scanned_at: now.toISOString(),
        payload_hash: code.startsWith("{")
          ? require("crypto").createHash("sha256").update(code).digest("hex").slice(0, 16)
          : null,
        metadata: { code_truncated: code.slice(0, 100) },
      });

      // Also write to pallet_operation_logs for backwards compatibility
      await supabase.from("pallet_operation_logs").insert({
        inventory_item_id: itemId,
        booking_id: bookingId,
        warehouse_id: warehouseId,
        operation: scanType === "view" ? "scan_view" : scanType,
        performed_by: user.id,
        performed_at: now.toISOString(),
        metadata: { code: code.slice(0, 100), source: "qr_scan" },
      });
    }

    const response = {
      id: item.pallet_id,
      type: item.type || item.item_type || "General",
      location: item.location_code || "Not assigned",
      status: item.status,
      customer: item.customer || "Unknown",
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    const errorResponse = handleApiError(error, { context: "Failed to search inventory" });
    return NextResponse.json(
      {
        error: errorResponse.message,
        ...(errorResponse.code && { code: errorResponse.code }),
      },
      { status: errorResponse.statusCode }
    );
  }
}
