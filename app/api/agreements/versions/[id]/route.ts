/**
 * Agreement Version Detail API Route
 * GET /api/agreements/versions/[id] - Get specific agreement version
 * PATCH /api/agreements/versions/[id] - Update agreement version (admin only)
 * DELETE /api/agreements/versions/[id] - Delete agreement version (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

/**
 * GET /api/agreements/versions/[id]
 * Get specific agreement version
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

    const { data, error } = await supabase
      .from('agreement_versions')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Agreement version not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in GET /api/agreements/versions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agreements/versions/[id]
 * Update agreement version (admin only)
 */
export async function PATCH(
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
    const updates: any = {};

    // Only allow updating certain fields
    const allowedFields = [
      'title',
      'content',
      'pdf_url',
      'is_active',
      'is_draft',
      'expiry_date',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('agreement_versions')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating agreement version:', error);
      return NextResponse.json(
        { error: 'Failed to update agreement version' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in PATCH /api/agreements/versions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agreements/versions/[id]
 * Delete agreement version (admin only)
 * Note: This is a soft delete - sets is_active to false
 */
export async function DELETE(
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

    // Soft delete by setting is_active to false
    const { data, error } = await supabase
      .from('agreement_versions')
      .update({ is_active: false })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error deleting agreement version:', error);
      return NextResponse.json(
        { error: 'Failed to delete agreement version' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Agreement version deactivated' });
  } catch (error) {
    console.error('Error in DELETE /api/agreements/versions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
