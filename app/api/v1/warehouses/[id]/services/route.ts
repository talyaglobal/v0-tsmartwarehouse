import { NextRequest, NextResponse } from "next/server"
import { getWarehouseServices } from "@/lib/services/warehouse-services"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const warehouseId = resolvedParams.id

    if (!warehouseId) {
      return NextResponse.json(
        { success: false, error: "Warehouse ID is required" },
        { status: 400 }
      )
    }

    const services = await getWarehouseServices(warehouseId)

    return NextResponse.json({
      success: true,
      services,
    })
  } catch (error) {
    console.error("Error fetching warehouse services:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
