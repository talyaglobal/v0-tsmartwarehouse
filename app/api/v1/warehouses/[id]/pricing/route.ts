import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createAuthenticatedSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"

/**
 * POST /api/v1/warehouses/[id]/pricing
 * Upsert warehouse pricing (owners only)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const warehouseId = params.id
    console.log('[pricing POST] incoming request for warehouse id=', warehouseId)

    const authResult = await requireAuth(request as any)
    if (authResult instanceof NextResponse) return authResult

    const { user } = authResult

    const body = await request.json()
    console.log('[pricing POST] body=', JSON.stringify(body))
    const { pricingType, basePrice, unit, minQuantity, maxQuantity, volumeDiscounts } = body

    if (!pricingType || !basePrice) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Use server client for admin operations (bypass RLS)
    const supabase = await createServerSupabaseClient()

    // Verify user company owns the warehouse or user is admin/root
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.log('[pricing POST] Profile not found for user:', user.id, profileError)
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    const { data: warehouse, error: warehouseError } = await supabase
      .from('warehouses')
      .select('owner_company_id')
      .eq('id', warehouseId)
      .single()

    if (warehouseError || !warehouse) {
      console.log('[pricing POST] Warehouse not found:', warehouseId, warehouseError)
      return NextResponse.json({ success: false, error: 'Warehouse not found' }, { status: 404 })
    }

    console.log('[pricing POST] Profile:', profile, 'Warehouse:', warehouse)

    if (profile.role !== 'root' && profile.company_id !== warehouse.owner_company_id) {
      console.log('[pricing POST] Forbidden: User company', profile.company_id, 'does not own warehouse', warehouse.owner_company_id)
      return NextResponse.json({ success: false, error: 'Forbidden: You can only set pricing for your own warehouses' }, { status: 403 })
    }

    // Check if pricing already exists for this warehouse and type
    const { data: existingPricing, error: fetchError } = await supabase
      .from('warehouse_pricing')
      .select('id')
      .eq('warehouse_id', warehouseId)
      .eq('pricing_type', pricingType)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.log('[pricing POST] Fetch error:', fetchError)
      throw fetchError
    }

    console.log('[pricing POST] Existing pricing:', existingPricing)

    let data, error

    if (existingPricing) {
      // Update existing pricing
      const updatePayload = {
        base_price: basePrice,
        unit: unit || (pricingType === 'pallet' ? 'per_pallet_per_day' : 'per_sqft_per_day'),
        min_quantity: minQuantity || null,
        max_quantity: maxQuantity || null,
        volume_discounts: volumeDiscounts || null,
        status: true,
        updated_at: new Date().toISOString(),
      }

      console.log('[pricing POST] Updating pricing:', updatePayload)

      const result = await supabase
        .from('warehouse_pricing')
        .update(updatePayload)
        .eq('id', existingPricing.id)
        .select()

      data = result.data
      error = result.error
    } else {
      // Insert new pricing
      const insertPayload = {
        warehouse_id: warehouseId,
        pricing_type: pricingType,
        base_price: basePrice,
        unit: unit || (pricingType === 'pallet' ? 'per_pallet_per_day' : 'per_sqft_per_day'),
        min_quantity: minQuantity || null,
        max_quantity: maxQuantity || null,
        volume_discounts: volumeDiscounts || null,
        status: true,
      }

      console.log('[pricing POST] Inserting pricing:', insertPayload)

      const result = await supabase
        .from('warehouse_pricing')
        .insert(insertPayload)
        .select()

      data = result.data
      error = result.error
    }

    if (error) {
      console.log('[pricing POST] Operation error:', error)
      throw error
    }

    console.log('[pricing POST] Success, data:', data)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const err = handleApiError(error, { context: 'Failed to upsert warehouse pricing' })
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode })
  }
}

/**
 * GET /api/v1/warehouses/[id]/pricing
 * Get pricing entries for a warehouse
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const warehouseId = params.id

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('warehouse_pricing')
      .select('id, pricing_type, base_price, unit, min_quantity, max_quantity, volume_discounts, status')
      .eq('warehouse_id', warehouseId)
      .eq('status', true)

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const err = handleApiError(error, { context: 'Failed to fetch warehouse pricing' })
    return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode })
  }
}
