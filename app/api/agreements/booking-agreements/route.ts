/**
 * Booking Agreements API Route
 * GET /api/agreements/booking-agreements - Get booking agreement acceptances
 * POST /api/agreements/booking-agreements - Record booking agreement acceptance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/agreements/booking-agreements
 * Get booking agreement acceptances
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
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json(
        { error: 'bookingId parameter is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('customer_id, warehouse_id')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role && ['root', 'warehouse_admin', 'company_admin'].includes(profile.role);
    const isCustomer = booking.customer_id === user.id;

    // Check if user is warehouse owner
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('owner_company_id')
      .eq('id', booking.warehouse_id)
      .single();

    const isWarehouseOwner = warehouse && profile?.company_id === warehouse.owner_company_id;

    if (!isAdmin && !isCustomer && !isWarehouseOwner) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have access to this booking' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('booking_agreements')
      .select(`
        *,
        agreement_version:agreement_versions(*),
        accepted_by_profile:profiles(id, name, email)
      `)
      .eq('booking_id', bookingId)
      .order('accepted_at', { ascending: false });

    if (error) {
      console.error('Error fetching booking agreements:', error);
      return NextResponse.json(
        { error: 'Failed to fetch booking agreements' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in GET /api/agreements/booking-agreements:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agreements/booking-agreements
 * Record booking agreement acceptance
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
      bookingId,
      agreementVersionId,
      signatureText,
      signatureMethod = 'typed',
      metadata = {},
    } = body;

    if (!bookingId || !agreementVersionId) {
      return NextResponse.json(
        { error: 'bookingId and agreementVersionId are required' },
        { status: 400 }
      );
    }

    // Verify user has access to this booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('customer_id')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.customer_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You are not the customer for this booking' },
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
      .from('booking_agreements')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('agreement_version_id', agreementVersionId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Agreement already accepted for this booking' },
        { status: 409 }
      );
    }

    // Insert new acceptance
    const { data, error } = await supabase
      .from('booking_agreements')
      .insert({
        booking_id: bookingId,
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
      console.error('Error creating booking agreement:', error);
      return NextResponse.json(
        { error: 'Failed to record agreement acceptance', details: error.message },
        { status: 500 }
      );
    }

    // Update JSONB cache in bookings table
    const { data: agreementVersion } = await supabase
      .from('agreement_versions')
      .select('agreement_type, version')
      .eq('id', agreementVersionId)
      .single();

    if (agreementVersion) {
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('booking_agreements')
        .eq('id', bookingId)
        .single();

      const bookingAgreements = bookingData?.booking_agreements || {};
      bookingAgreements[agreementVersion.agreement_type] = {
        version: agreementVersion.version,
        accepted_at: new Date().toISOString(),
      };

      await supabase
        .from('bookings')
        .update({ booking_agreements: bookingAgreements })
        .eq('id', bookingId);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/agreements/booking-agreements:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
