/**
 * Agreement Check API Route
 * POST /api/agreements/check - Check if user needs to accept agreements
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AgreementType } from '@/features/agreements/types';

/** Shape returned by get_latest_agreement_version RPC */
interface AgreementVersionRow {
  id: string;
  version?: number;
  is_major_version?: boolean;
}

/**
 * POST /api/agreements/check
 * Check if user has accepted required agreements
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
    const { agreementTypes, context } = body;

    if (!agreementTypes || !Array.isArray(agreementTypes)) {
      return NextResponse.json(
        { error: 'agreementTypes array is required' },
        { status: 400 }
      );
    }

    const results: Record<string, any> = {};

    for (const agreementType of agreementTypes) {
      // Get latest version of this agreement
      const { data: latestVersionData } = await supabase
        .rpc('get_latest_agreement_version', {
          p_agreement_type: agreementType,
          p_language: 'en',
        })
        .single();
      const latestVersion = latestVersionData as AgreementVersionRow | null;

      if (!latestVersion) {
        results[agreementType] = {
          required: true,
          accepted: false,
          needsReacceptance: true,
          error: 'Agreement version not found',
        };
        continue;
      }

      // Check if user has accepted this agreement
      const { data: userAgreement } = await supabase
        .from('user_agreements')
        .select(`
          *,
          agreement_version:agreement_versions(version, is_major_version)
        `)
        .eq('user_id', user.id)
        .eq('agreement_version_id', latestVersion.id)
        .single();

      if (userAgreement) {
        results[agreementType] = {
          required: true,
          accepted: true,
          needsReacceptance: false,
          currentVersion: latestVersion.version,
          acceptedAt: userAgreement.accepted_at,
        };
      } else {
        // Check if user has accepted an older version
        const { data: oldAgreement } = await supabase
          .from('user_agreements')
          .select(`
            *,
            agreement_version:agreement_versions(
              version,
              is_major_version,
              agreement_type
            )
          `)
          .eq('user_id', user.id)
          .eq('agreement_version.agreement_type', agreementType)
          .order('accepted_at', { ascending: false })
          .limit(1)
          .single();

        results[agreementType] = {
          required: true,
          accepted: !!oldAgreement,
          needsReacceptance: !oldAgreement || latestVersion.is_major_version,
          currentVersion: latestVersion.version,
          latestVersion: latestVersion.version,
          acceptedVersion: oldAgreement?.agreement_version?.version,
          acceptedAt: oldAgreement?.accepted_at,
        };
      }
    }

    // Check context-specific agreements
    if (context?.warehouseId) {
      // Check warehouse-specific agreements
      const warehouseAgreementTypes = [
        AgreementType.WAREHOUSE_OWNER_SERVICE,
        AgreementType.SERVICE_LEVEL_AGREEMENT,
        AgreementType.INSURANCE_LIABILITY,
      ];

      for (const agreementType of warehouseAgreementTypes) {
        if (!agreementTypes.includes(agreementType)) {
          const { data: latestVersionData } = await supabase
            .rpc('get_latest_agreement_version', {
              p_agreement_type: agreementType,
              p_language: 'en',
            })
            .single();
          const latestVersion = latestVersionData as AgreementVersionRow | null;

          if (latestVersion) {
            const { data: warehouseAgreement } = await supabase
              .from('warehouse_agreements')
              .select('*')
              .eq('warehouse_id', context.warehouseId)
              .eq('agreement_version_id', latestVersion.id)
              .single();

            results[agreementType] = {
              required: true,
              accepted: !!warehouseAgreement,
              needsReacceptance: !warehouseAgreement,
              currentVersion: latestVersion.version,
            };
          }
        }
      }
    }

    if (context?.bookingId) {
      // Check booking-specific agreements
      const bookingAgreementTypes = [
        AgreementType.CUSTOMER_BOOKING,
        AgreementType.CANCELLATION_REFUND,
      ];

      for (const agreementType of bookingAgreementTypes) {
        if (!agreementTypes.includes(agreementType)) {
          const { data: latestVersionData } = await supabase
            .rpc('get_latest_agreement_version', {
              p_agreement_type: agreementType,
              p_language: 'en',
            })
            .single();
          const latestVersion = latestVersionData as AgreementVersionRow | null;

          if (latestVersion) {
            const { data: bookingAgreement } = await supabase
              .from('booking_agreements')
              .select('*')
              .eq('booking_id', context.bookingId)
              .eq('agreement_version_id', latestVersion.id)
              .single();

            results[agreementType] = {
              required: true,
              accepted: !!bookingAgreement,
              needsReacceptance: !bookingAgreement,
              currentVersion: latestVersion.version,
            };
          }
        }
      }
    }

    // Calculate overall status
    const allAccepted = Object.values(results).every((r: any) => r.accepted && !r.needsReacceptance);
    const needsAction = Object.values(results).some((r: any) => !r.accepted || r.needsReacceptance);

    return NextResponse.json({
      success: true,
      allAccepted,
      needsAction,
      agreements: results,
    });
  } catch (error) {
    console.error('Error in POST /api/agreements/check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
