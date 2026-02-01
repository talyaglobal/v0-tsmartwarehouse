/**
 * Agreement Seeding API Route
 * POST /api/agreements/seed - Seed initial agreement versions from templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AgreementType } from '@/features/agreements/types';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * POST /api/agreements/seed
 * Seed agreement versions from markdown templates
 * Admin only
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
    const { force = false, language = 'en' } = body;

    // Define agreement templates to seed
    const agreementTemplates = [
      {
        type: AgreementType.TERMS_OF_SERVICE,
        file: 'tos.md',
        title: 'Terms of Service',
        isMajorVersion: true,
      },
      {
        type: AgreementType.PRIVACY_POLICY,
        file: 'privacy-policy.md',
        title: 'Privacy Policy',
        isMajorVersion: true,
      },
      {
        type: AgreementType.WAREHOUSE_OWNER_SERVICE,
        file: 'warehouse-owner-service.md',
        title: 'Warehouse Owner Service Agreement',
        isMajorVersion: true,
      },
      {
        type: AgreementType.CUSTOMER_BOOKING,
        file: 'customer-booking.md',
        title: 'Customer Booking Agreement',
        isMajorVersion: true,
      },
      {
        type: AgreementType.CANCELLATION_REFUND,
        file: 'cancellation-refund.md',
        title: 'Cancellation and Refund Policy',
        isMajorVersion: true,
      },
    ];

    const results: any[] = [];
    const errors: any[] = [];

    for (const template of agreementTemplates) {
      try {
        // Check if version already exists
        const { data: existing } = await supabase
          .from('agreement_versions')
          .select('id')
          .eq('agreement_type', template.type)
          .eq('version', '1.0')
          .eq('language', language)
          .single();

        if (existing && !force) {
          results.push({
            type: template.type,
            status: 'skipped',
            message: 'Version 1.0 already exists',
          });
          continue;
        }

        // Read template file
        const templatePath = join(
          process.cwd(),
          'features',
          'agreements',
          'templates',
          template.file
        );

        let content: string;
        try {
          content = await readFile(templatePath, 'utf-8');
        } catch (readError) {
          errors.push({
            type: template.type,
            error: `Template file not found: ${template.file}`,
          });
          continue;
        }

        // Insert or update agreement version
        if (existing && force) {
          const { error: updateError } = await supabase
            .from('agreement_versions')
            .update({
              title: template.title,
              content,
              is_major_version: template.isMajorVersion,
              effective_date: new Date().toISOString().split('T')[0],
              is_active: true,
              is_draft: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            errors.push({
              type: template.type,
              error: updateError.message,
            });
          } else {
            results.push({
              type: template.type,
              status: 'updated',
              message: 'Version 1.0 updated',
            });
          }
        } else {
          const { error: insertError } = await supabase
            .from('agreement_versions')
            .insert({
              agreement_type: template.type,
              version: '1.0',
              title: template.title,
              content,
              is_major_version: template.isMajorVersion,
              effective_date: new Date().toISOString().split('T')[0],
              language,
              is_active: true,
              is_draft: false,
              created_by: user.id,
            });

          if (insertError) {
            errors.push({
              type: template.type,
              error: insertError.message,
            });
          } else {
            results.push({
              type: template.type,
              status: 'created',
              message: 'Version 1.0 created',
            });
          }
        }
      } catch (error: any) {
        errors.push({
          type: template.type,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      results,
      errors,
      summary: {
        total: agreementTemplates.length,
        created: results.filter(r => r.status === 'created').length,
        updated: results.filter(r => r.status === 'updated').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        failed: errors.length,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/agreements/seed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
