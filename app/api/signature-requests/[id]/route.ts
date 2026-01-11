/**
 * Individual Signature Request API Route
 * Handles HTTP requests for specific signature requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  getSignatureRequest,
  updateSignatureRequestStatus,
  cancelSignatureRequest,
  resendSigningInvitation,
} from '@/features/contacts/actions';
import { SignatureStatus } from '@/features/contacts/types';

/**
 * GET /api/signature-requests/[id]
 * Get a specific signature request by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await getSignatureRequest(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Signature request not found' ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error fetching signature request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signature request' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/signature-requests/[id]
 * Handle signature request actions (cancel, resend, status)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const action = searchParams.get('action');

    if (action === 'cancel') {
      const result = await cancelSignatureRequest(id);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'resend') {
      const result = await resendSigningInvitation(id);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'status') {
      const body = await request.json();
      const status = body.status as SignatureStatus;
      const signedDocumentUrl = body.signedDocumentUrl;

      const result = await updateSignatureRequestStatus(
        id,
        status,
        signedDocumentUrl
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, data: result.data });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use cancel, resend, or status' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error handling signature request action:', error);
    return NextResponse.json(
      { error: 'Failed to handle signature request action' },
      { status: 500 }
    );
  }
}

