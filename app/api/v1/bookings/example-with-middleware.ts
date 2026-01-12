/**
 * Example API route using the new middleware wrapper
 * This demonstrates how to migrate existing API routes to use the new infrastructure
 */

import { type NextRequest } from "next/server"
import { withApiMiddleware, apiResponse, apiError } from "@/lib/middleware/api-wrapper"
import { getDbClient } from "@/lib/db/client"
import { PRICING } from "@/lib/constants"
import { logger } from "@/lib/utils/logger"

// Example GET handler with middleware
export const GET = withApiMiddleware(
  async (request: NextRequest, context) => {
    const { user } = context || {}
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId")
    const status = searchParams.get("status")
    const type = searchParams.get("type")

    try {
      const db = getDbClient()
      
      // Build query
      let query = db.from("bookings").select("*")

      // Apply filters
      if (customerId) {
        query = query.eq("customer_id", customerId)
      }
      if (status) {
        query = query.eq("status", status)
      }
      if (type) {
        query = query.eq("type", type)
      }

      // Role-based filtering: warehouse_clients can only see their own bookings
      if (user?.role === "warehouse_client" && !customerId) {
        query = query.eq("customer_id", user.id)
      }

      const { data: bookings, error } = await query

      if (error) {
        logger.error("Failed to fetch bookings", error, { customerId, status, type })
        return apiError("Failed to fetch bookings", 500)
      }

      return apiResponse({
        data: bookings || [],
        total: bookings?.length || 0,
      })
    } catch (error) {
      logger.error("Unexpected error in GET /api/v1/bookings", error as Error)
      return apiError("Internal server error", 500)
    }
  },
  {
    requireAuth: true, // Require authentication
    rateLimit: "api", // Use API rate limit preset
    methods: ["GET"], // Only allow GET method
  }
)

// Example POST handler with middleware
export const POST = withApiMiddleware(
  async (request: NextRequest, context) => {
    const { user } = context || {}
    try {
      const body = await request.json()
      const { type, palletCount, areaSqFt, floorNumber, startDate, endDate, notes } = body

      // Validate required fields
      if (!type || !startDate) {
        return apiError("Missing required fields: type, startDate", 400)
      }

      // Calculate pricing
      let totalAmount = 0
      if (type === "pallet" && palletCount) {
        const handlingIn = palletCount * PRICING.palletIn
        const storage = palletCount * PRICING.storagePerPalletPerMonth
        totalAmount = handlingIn + storage
      } else if (type === "area-rental" && areaSqFt) {
        if (areaSqFt < PRICING.areaRentalMinSqFt) {
          return apiError(
            `Minimum area rental is ${PRICING.areaRentalMinSqFt} sq ft`,
            400
          )
        }
        totalAmount = areaSqFt * PRICING.areaRentalPerSqFtPerYear
      } else {
        return apiError("Invalid booking type or missing required fields", 400)
      }

      // Create booking in database
      const db = getDbClient()
      const { data: booking, error } = await db
        .from("bookings")
        .insert({
          customer_id: user!.id, // User is guaranteed by requireAuth
          customer_name: user!.email.split("@")[0], // Fallback, should fetch from users table
          customer_email: user!.email,
          warehouse_id: "wh-001", // Default warehouse
          type,
          status: "pending",
          pallet_count: palletCount,
          area_sq_ft: areaSqFt,
          floor_number: floorNumber,
          start_date: startDate,
          end_date: endDate,
          total_amount: totalAmount,
          notes,
        })
        .select()
        .single()

      if (error) {
        logger.error("Failed to create booking", error, { body, userId: user!.id })
        return apiError("Failed to create booking", 500)
      }

      logger.info("Booking created successfully", { bookingId: booking.id, userId: user!.id })

      return apiResponse(booking, 201, "Booking created successfully")
    } catch (error) {
      logger.error("Unexpected error in POST /api/v1/bookings", error as Error)
      return apiError("Invalid request body", 400)
    }
  },
  {
    requireAuth: true, // Require authentication
    requireRole: ["warehouse_client", "root"], // Only warehouse_clients and root admins can create bookings
    rateLimit: "api",
    methods: ["POST"],
  }
)

