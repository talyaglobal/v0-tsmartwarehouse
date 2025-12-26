import { NextRequest, NextResponse } from 'next/server'
import { generatePalletLabelData, validateLabelData } from '@/lib/business-logic/pallet-labels'
import { getInventoryItemById, updateInventoryItem } from '@/lib/db/inventory'
import { handleApiError } from '@/lib/utils/logger'

/**
 * GET /api/v1/inventory/[id]/label
 * Get pallet label data (JSON or PDF)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') // 'pdf' or 'json' (default)

    const labelData = await generatePalletLabelData(resolvedParams.id)

    // Validate label data
    const validation = validateLabelData(labelData)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Label data validation failed',
          errors: validation.errors,
        },
        { status: 400 }
      )
    }

    if (format === 'pdf') {
      // TODO: Generate PDF label
      // For now, return JSON with a note that PDF generation is pending
      return NextResponse.json({
        success: true,
        data: labelData,
        message: 'PDF generation not yet implemented',
      })
    }

    // Return JSON format
    return NextResponse.json({
      success: true,
      data: labelData,
    })
  } catch (error: any) {
    const errorResponse = handleApiError(error, { context: 'Failed to get pallet label' })
    return NextResponse.json(
      {
        error: errorResponse.message,
        ...(errorResponse.code && { code: errorResponse.code }),
      },
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * POST /api/v1/inventory/[id]/label
 * Update label-specific fields
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const body = await request.json()

    // Validate that item exists
    await getInventoryItemById(resolvedParams.id)

    // Update label fields
    const updates: any = {}
    if (body.expected_release_date !== undefined) updates.expected_release_date = body.expected_release_date
    if (body.stock_definition !== undefined) updates.stock_definition = body.stock_definition
    if (body.number_of_cases !== undefined) updates.number_of_cases = body.number_of_cases
    if (body.number_of_units !== undefined) updates.number_of_units = body.number_of_units
    if (body.unit_type !== undefined) updates.unit_type = body.unit_type
    if (body.hs_code !== undefined) updates.hs_code = body.hs_code
    if (body.storage_requirements !== undefined) updates.storage_requirements = body.storage_requirements

    const updatedItem = await updateInventoryItem(resolvedParams.id, updates)

    return NextResponse.json({
      success: true,
      data: updatedItem,
    })
  } catch (error: any) {
    const errorResponse = handleApiError(error, { context: 'Failed to update label fields' })
    return NextResponse.json(
      {
        error: errorResponse.message,
        ...(errorResponse.code && { code: errorResponse.code }),
      },
      { status: errorResponse.statusCode }
    )
  }
}

