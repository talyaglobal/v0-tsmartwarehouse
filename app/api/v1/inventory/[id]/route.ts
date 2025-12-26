import { NextRequest, NextResponse } from 'next/server'
import { getInventoryItemById, updateInventoryItem } from '@/lib/db/inventory'
import { handleApiError } from '@/lib/utils/logger'
import type { ApiResponse, ErrorResponse } from '@/types/api'
import type { InventoryItem } from '@/lib/db/inventory'

/**
 * GET /api/v1/inventory/[id]
 * Get a single inventory item by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const item = await getInventoryItemById(resolvedParams.id)

    if (!item) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Inventory item not found',
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    const responseData: ApiResponse<InventoryItem> = {
      success: true,
      data: item,
    }
    return NextResponse.json(responseData)
  } catch (error: any) {
    const errorResponse = handleApiError(error, { context: 'Failed to get inventory item' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * PATCH /api/v1/inventory/[id]
 * Update an inventory item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const body = await request.json()

    const updatedItem = await updateInventoryItem(resolvedParams.id, body)

    const responseData: ApiResponse<InventoryItem> = {
      success: true,
      data: updatedItem,
    }
    return NextResponse.json(responseData)
  } catch (error: any) {
    const errorResponse = handleApiError(error, { context: 'Failed to update inventory item' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

