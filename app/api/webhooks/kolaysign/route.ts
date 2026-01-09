/**
 * KolaySign Webhook Handler
 * Receives and processes webhook events from KolaySign
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { initializeKolaySignService } from '@/features/contacts/api/kolaysign-service';
import { updateSignatureRequestStatus } from '@/features/contacts/actions';
import { SignatureStatus } from '@/features/contacts/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const kolaySignService = initializeKolaySignService();

    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('X-KolaySign-Signature');

    // Verify webhook signature
    if (signature && process.env.KOLAYSIGN_WEBHOOK_SECRET) {
      const isValid = kolaySignService.verifyWebhookSignature(body, signature);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(body);
    const { event, requestId, kolaySignRequestId, documentId, signedAt, signedDocumentUrl, reason } = payload;

    // Find signature request by KolaySign request ID
    const { data: signatureRequest, error: fetchError } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('kolaysign_request_id', kolaySignRequestId)
      .single();

    if (fetchError || !signatureRequest) {
      console.error('Signature request not found:', kolaySignRequestId);
      return NextResponse.json(
        { error: 'Signature request not found' },
        { status: 404 }
      );
    }

    // Process event
    let newStatus: SignatureStatus;
    let signedUrl: string | undefined;

    switch (event) {
      case 'signed':
        newStatus = SignatureStatus.SIGNED;
        signedUrl = signedDocumentUrl;
        break;
      case 'rejected':
        newStatus = SignatureStatus.REJECTED;
        break;
      case 'expired':
        newStatus = SignatureStatus.EXPIRED;
        break;
      default:
        console.error('Unknown event type:', event);
        return NextResponse.json(
          { error: 'Unknown event type' },
          { status: 400 }
        );
    }

    // Update signature request status
    const result = await updateSignatureRequestStatus(
      signatureRequest.id,
      newStatus,
      signedUrl
    );

    if (!result.success) {
      console.error('Error updating signature request:', result.error);
      return NextResponse.json(
        { error: 'Failed to update signature request' },
        { status: 500 }
      );
    }

    // Log to audit_logs (if table exists)
    try {
      await supabase.from('audit_logs').insert({
        entity_type: 'signature_request',
        entity_id: signatureRequest.id,
        action: `webhook_${event}`,
        details: {
          event,
          kolaySignRequestId,
          documentId,
          signedAt,
          signedDocumentUrl,
          reason,
        },
      });
    } catch (auditError) {
      // Audit logging is optional, don't fail the webhook
      console.warn('Failed to log to audit_logs:', auditError);
    }

    // TODO: Send notification to user about signature status change
    // This can be integrated with your existing notification system

    return NextResponse.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Error processing KolaySign webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

