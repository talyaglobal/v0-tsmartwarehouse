/**
 * Agreement Statistics API Route
 * GET /api/agreements/stats - Get agreement acceptance statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Normalize agreement_version from join (can be single object or array) */
function getAgreementType(agreement: { agreement_version?: unknown }): string | undefined {
  const v = agreement.agreement_version;
  if (!v) return undefined;
  const row = Array.isArray(v) ? v[0] : v;
  return (row as { agreement_type?: string })?.agreement_type;
}

/**
 * GET /api/agreements/stats
 * Get agreement acceptance statistics (admin only)
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['root', 'warehouse_admin', 'company_admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const agreementType = searchParams.get('type');

    // Get total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get user agreement stats
    let userAgreementQuery = supabase
      .from('user_agreements')
      .select(`
        id,
        accepted_at,
        agreement_version:agreement_versions(agreement_type, version)
      `);

    if (agreementType) {
      userAgreementQuery = userAgreementQuery.eq('agreement_version.agreement_type', agreementType);
    }

    const { data: userAgreements, count: totalUserAgreements } = await userAgreementQuery;

    // Get warehouse agreement stats
    const { count: totalWarehouseAgreements } = await supabase
      .from('warehouse_agreements')
      .select('*', { count: 'exact', head: true });

    // Get booking agreement stats
    const { count: totalBookingAgreements } = await supabase
      .from('booking_agreements')
      .select('*', { count: 'exact', head: true });

    // Group user agreements by type
    const byType: Record<string, any> = {};
    if (userAgreements) {
      for (const agreement of userAgreements) {
        const type = getAgreementType(agreement);
        if (type) {
          if (!byType[type]) {
            byType[type] = {
              type,
              count: 0,
              acceptanceRate: 0,
              recentAcceptances: [],
            };
          }
          byType[type].count++;
          byType[type].recentAcceptances.push(agreement.accepted_at);
        }
      }

      // Calculate acceptance rates
      for (const type in byType) {
        byType[type].acceptanceRate = totalUsers ? 
          ((byType[type].count / totalUsers) * 100).toFixed(2) : 0;
        byType[type].recentAcceptances = byType[type].recentAcceptances
          .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())
          .slice(0, 10);
      }
    }

    // Get acceptance trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentAcceptances } = await supabase
      .from('user_agreements')
      .select('accepted_at, agreement_version:agreement_versions(agreement_type)')
      .gte('accepted_at', thirtyDaysAgo.toISOString())
      .order('accepted_at', { ascending: false });

    // Group by date
    const dailyAcceptances: Record<string, number> = {};
    if (recentAcceptances) {
      for (const acceptance of recentAcceptances) {
        const date = new Date(acceptance.accepted_at).toISOString().split('T')[0];
        dailyAcceptances[date] = (dailyAcceptances[date] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalUserAgreements,
          totalWarehouseAgreements,
          totalBookingAgreements,
          overallAcceptanceRate: totalUsers && totalUserAgreements ? 
            ((totalUserAgreements / totalUsers) * 100).toFixed(2) : 0,
        },
        byType,
        trends: {
          last30Days: dailyAcceptances,
          recentAcceptances: recentAcceptances?.slice(0, 20) || [],
        },
      },
    });
  } catch (error) {
    console.error('Error in GET /api/agreements/stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
