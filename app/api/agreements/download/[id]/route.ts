/**
 * Agreement Download API Route
 * GET /api/agreements/download/[id] - Download agreement as PDF or markdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

/**
 * GET /api/agreements/download/[id]
 * Download agreement version as PDF or markdown
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = createServerSupabaseClient();
    const params = context.params instanceof Promise ? await context.params : context.params;
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'pdf'; // 'pdf' or 'markdown'

    // Get agreement version
    const { data: agreementVersion, error: fetchError } = await supabase
      .from('agreement_versions')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !agreementVersion) {
      return NextResponse.json(
        { error: 'Agreement version not found' },
        { status: 404 }
      );
    }

    if (format === 'pdf') {
      // Check if PDF exists
      if (!agreementVersion.pdf_url) {
        return NextResponse.json(
          { error: 'PDF not available for this agreement. Please generate it first.' },
          { status: 404 }
        );
      }

      // Redirect to PDF URL in Supabase Storage
      return NextResponse.redirect(agreementVersion.pdf_url);
    } else if (format === 'markdown') {
      // Return markdown content as downloadable file
      const filename = `${agreementVersion.agreement_type}_v${agreementVersion.version}.md`;
      
      return new NextResponse(agreementVersion.content, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Use "pdf" or "markdown"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in GET /api/agreements/download/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
