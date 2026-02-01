/**
 * User Agreements API Route
 * GET /api/agreements/user-agreements - Get user's agreement acceptances
 * POST /api/agreements/user-agreements - Record agreement acceptance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/agreements/user-agreements
 * Get all agreement acceptances for the current user
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
    const agreementType = searchParams.get('type');

    let query = supabase
      .from('user_agreements')
      .select(`
        *,
        agreement_version:agreement_versions(*)
      `)
      .eq('user_id', user.id)
      .order('accepted_at', { ascending: false });

    if (agreementType) {
      query = query.eq('agreement_version.agreement_type', agreementType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user agreements:', error);
      return NextResponse.json(
        { error: 'Failed to fetch user agreements' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in GET /api/agreements/user-agreements:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agreements/user-agreements
 * Record a new agreement acceptance
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
      agreementVersionId,
      signatureText,
      signatureMethod = 'typed',
      metadata = {},
    } = body;

    if (!agreementVersionId) {
      return NextResponse.json(
        { error: 'agreementVersionId is required' },
        { status: 400 }
      );
    }

    // Get IP and user agent from request
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check if already accepted
    const { data: existing } = await supabase
      .from('user_agreements')
      .select('id')
      .eq('user_id', user.id)
      .eq('agreement_version_id', agreementVersionId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Agreement already accepted' },
        { status: 409 }
      );
    }

    // Insert new acceptance
    const { data, error } = await supabase
      .from('user_agreements')
      .insert({
        user_id: user.id,
        agreement_version_id: agreementVersionId,
        accepted_ip: ip,
        accepted_user_agent: userAgent,
        acceptance_method: 'web',
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
      console.error('Error creating user agreement:', error);
      return NextResponse.json(
        { error: 'Failed to record agreement acceptance', details: error.message },
        { status: 500 }
      );
    }

    // Also update the JSONB cache in profiles
    const { data: agreementVersion } = await supabase
      .from('agreement_versions')
      .select('agreement_type, version')
      .eq('id', agreementVersionId)
      .single();

    if (agreementVersion) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agreements_accepted')
        .eq('id', user.id)
        .single();

      const agreementsAccepted = profile?.agreements_accepted || {};
      agreementsAccepted[agreementVersion.agreement_type] = {
        version: agreementVersion.version,
        accepted_at: new Date().toISOString(),
        ip,
        user_agent: userAgent,
      };

      await supabase
        .from('profiles')
        .update({ agreements_accepted: agreementsAccepted })
        .eq('id', user.id);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/agreements/user-agreements:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
