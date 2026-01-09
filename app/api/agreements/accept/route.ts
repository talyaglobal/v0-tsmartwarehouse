/**
 * Agreement Acceptance API Route
 * Handles agreement acceptance requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  acceptUserAgreement,
  acceptWarehouseAgreement,
  acceptBookingAgreement,
} from '@/features/agreements/actions';

/**
 * POST /api/agreements/accept
 * Accept an agreement
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
    const { agreementType, signatureText, signatureMethod, metadata, warehouseId, bookingId } = body;
    
    // Get IP and user agent from request
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    if (!agreementType) {
      return NextResponse.json(
        { error: 'agreementType is required' },
        { status: 400 }
      );
    }

    const input = {
      agreementType,
      userId: user.id,
      signatureText,
      signatureMethod,
      metadata: {
        ...metadata,
        ip,
        userAgent,
      },
    };

    let result;

    if (warehouseId) {
      result = await acceptWarehouseAgreement({ ...input, warehouseId });
    } else if (bookingId) {
      result = await acceptBookingAgreement({ ...input, bookingId });
    } else {
      result = await acceptUserAgreement(input);
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error accepting agreement:', error);
    return NextResponse.json(
      { error: 'Failed to accept agreement' },
      { status: 500 }
    );
  }
}

