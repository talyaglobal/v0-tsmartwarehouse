import { NextRequest, NextResponse } from "next/server"
import { calculatePrice } from "@/lib/services/pricing"
import type { PriceCalculation } from "@/types/marketplace"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[pricing API] Request body:', JSON.stringify(body, null, 2))
    
    const params: PriceCalculation = {
      warehouse_id: body.warehouse_id,
      type: body.type,
      quantity: body.quantity,
      start_date: body.start_date,
      end_date: body.end_date,
      pallet_details: body.pallet_details,
    }

    // Validate required fields
    if (!params.warehouse_id || !params.type || params.quantity == null || !params.start_date || !params.end_date) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: warehouse_id, type, quantity, start_date, end_date",
        },
        { status: 400 }
      )
    }

    const breakdown = await calculatePrice(params)

    // Add debug info to response
    return NextResponse.json({
      success: true,
      breakdown,
      _debug: {
        hasPalletDetails: !!body.pallet_details,
        palletDetailsCount: body.pallet_details?.pallets?.length ?? 0,
        requestedType: body.type,
      }
    })
  } catch (error) {
    console.error("Error calculating price:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

