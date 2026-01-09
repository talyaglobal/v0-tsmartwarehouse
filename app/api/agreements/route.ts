/**
 * Agreements API Route
 * Handles HTTP requests for agreement management
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getLatestAgreementVersion, getUserAgreementStatuses } from '@/features/agreements/actions';
import { AgreementType } from '@/features/agreements/types';

/**
 * GET /api/agreements
 * Get agreement information
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
    const action = searchParams.get('action'); // 'latest' or 'statuses'

    if (action === 'statuses') {
      // Get all agreement statuses for user
      const result = await getUserAgreementStatuses(user.id);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, data: result.data });
    }

    if (agreementType) {
      // Get latest version of specific agreement
      const result = await getLatestAgreementVersion(agreementType, language);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: result.data });
    }

    return NextResponse.json(
      { error: 'Either type or action=statuses is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching agreements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agreements' },
      { status: 500 }
    );
  }
}

