/**
 * Warehouse Agreements API Route
 * GET /api/agreements/warehouse-agreements - Get warehouse agreement acceptances
 * POST /api/agreements/warehouse-agreements - Record warehouse agreement acceptance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/agreements/warehouse-agreements
 * Get warehouse agreement acceptances
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId');

    if (!warehouseId) {
      return NextResponse.json(
        { error: 'warehouseId parameter is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this warehouse
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('owner_company_id')
      .eq('id', warehouseId)
      .single();

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role && ['root', 'warehouse_admin'].includes(profile.role);
    const isOwner = profile?.company_id === warehouse.owner_company_id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have access to this warehouse' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('warehouse_agreements')
      .select(`
        *,
        agreement_version:agreement_versions(*),
        accepted_by_profile:profiles(id, name, email)
      `)
      .eq('warehouse_id', warehouseId)
      .order('accepted_at', { ascending: false });

    if (error) {
      console.error('Error fetching warehouse agreements:', error);
      return NextResponse.json(
        { error: 'Failed to fetch warehouse agreements' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in GET /api/agreements/warehouse-agreements:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agreements/warehouse-agreements
 * Record warehouse agreement acceptance
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      warehouseId,
      agreementVersionId,
      signatureText,
      signatureMethod = 'typed',
      metadata = {},
    } = body;

    if (!warehouseId || !agreementVersionId) {
      return NextResponse.json(
        { error: 'warehouseId and agreementVersionId are required' },
        { status: 400 }
      );
    }

    // Verify user has access to this warehouse
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('owner_company_id')
      .eq('id', warehouseId)
      .single();

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profile?.company_id !== warehouse.owner_company_id) {
      return NextResponse.json(
        { error: 'Forbidden - You do not own this warehouse' },
        { status: 403 }
      );
    }

    // Get IP and user agent
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check if already accepted
    const { data: existing } = await supabase
      .from('warehouse_agreements')
      .select('id')
      .eq('warehouse_id', warehouseId)
      .eq('agreement_version_id', agreementVersionId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Agreement already accepted for this warehouse' },
        { status: 409 }
      );
    }

    // Insert new acceptance
    const { data, error } = await supabase
      .from('warehouse_agreements')
      .insert({
        warehouse_id: warehouseId,
        agreement_version_id: agreementVersionId,
        accepted_by: user.id,
        accepted_ip: ip,
        accepted_user_agent: userAgent,
        signature_text: signatureText,
        signature_method: signatureMethod,
        metadata,
      })
      .select(`
        *,
        agreement_version:agreement_versions(*)
      `)
      .single();

    if (error) {
      console.error('Error creating warehouse agreement:', error);
      return NextResponse.json(
        { error: 'Failed to record agreement acceptance', details: error.message },
        { status: 500 }
      );
    }

    // Update JSONB cache in warehouses table
    const { data: agreementVersion } = await supabase
      .from('agreement_versions')
      .select('agreement_type, version')
      .eq('id', agreementVersionId)
      .single();

    if (agreementVersion) {
      const { data: warehouseData } = await supabase
        .from('warehouses')
        .select('owner_agreements')
        .eq('id', warehouseId)
        .single();

      const ownerAgreements = warehouseData?.owner_agreements || {};
      ownerAgreements[agreementVersion.agreement_type] = {
        version: agreementVersion.version,
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      };

      await supabase
        .from('warehouses')
        .update({ owner_agreements: ownerAgreements })
        .eq('id', warehouseId);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/agreements/warehouse-agreements:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
