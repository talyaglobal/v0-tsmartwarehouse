/**
 * Agreement Versions API Route
 * GET /api/agreements/versions - Get all agreement versions
 * POST /api/agreements/versions - Create new agreement version (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AgreementType } from '@/features/agreements/types';

/**
 * GET /api/agreements/versions
 * Get all agreement versions or filter by type
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
    const agreementType = searchParams.get('type') as AgreementType | null;
    const language = searchParams.get('language') || 'en';
    const includeInactive = searchParams.get('includeInactive') === 'true';

    let query = supabase
      .from('agreement_versions')
      .select('*')
      .eq('language', language)
      .eq('is_draft', false);

    if (agreementType) {
      query = query.eq('agreement_type', agreementType);
    }

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    query = query.order('effective_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching agreement versions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch agreement versions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in GET /api/agreements/versions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agreements/versions
 * Create new agreement version (admin only)
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['root', 'warehouse_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      agreementType,
      version,
      title,
      content,
      isMajorVersion = false,
      effectiveDate,
      expiryDate = null,
      language = 'en',
      isActive = true,
      isDraft = false,
    } = body;

    // Validate required fields
    if (!agreementType || !version || !title || !content || !effectiveDate) {
      return NextResponse.json(
        { error: 'Missing required fields: agreementType, version, title, content, effectiveDate' },
        { status: 400 }
      );
    }

    // Insert new agreement version
    const { data, error } = await supabase
      .from('agreement_versions')
      .insert({
        agreement_type: agreementType,
        version,
        title,
        content,
        is_major_version: isMajorVersion,
        effective_date: effectiveDate,
        expiry_date: expiryDate,
        language,
        is_active: isActive,
        is_draft: isDraft,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating agreement version:', error);
      return NextResponse.json(
        { error: 'Failed to create agreement version', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/agreements/versions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
