'use server';

/**
 * Agreement Management Server Actions
 * Handles all server-side operations for agreement management
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  AgreementType,
  AgreementVersion,
  UserAgreement,
  WarehouseAgreement,
  BookingAgreement,
  AgreementAcceptanceInput,
  AgreementCheckResult,
  AgreementStatus,
} from './types';

/**
 * Get latest agreement version
 */
export async function getLatestAgreementVersion(
  agreementType: AgreementType,
  language: string = 'en'
): Promise<{ success: boolean; data?: AgreementVersion; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .rpc('get_latest_agreement_version', {
        p_agreement_type: agreementType,
        p_language: language,
      })
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return { success: false, error: 'No active agreement version found' };
    }

    const version: AgreementVersion = {
      id: data.id,
      agreementType: data.agreement_type as AgreementType,
      version: data.version,
      title: data.title,
      content: data.content,
      pdfUrl: data.pdf_url,
      isMajorVersion: data.is_major_version,
      effectiveDate: new Date(data.effective_date),
      expiryDate: data.expiry_date ? new Date(data.expiry_date) : undefined,
      language: language,
      isActive: true,
      isDraft: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { success: true, data: version };
  } catch (error) {
    console.error('Error fetching latest agreement version:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch agreement version',
    };
  }
}

/**
 * Check if user has accepted an agreement
 */
export async function checkUserAgreement(
  userId: string,
  agreementType: AgreementType
): Promise<{ success: boolean; data?: AgreementCheckResult; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    // Get latest version
    const latestVersionResult = await getLatestAgreementVersion(agreementType);
    if (!latestVersionResult.success || !latestVersionResult.data) {
      return {
        success: false,
        error: 'No active agreement version found',
      };
    }

    const latestVersion = latestVersionResult.data;

    // Check if user has accepted this version
    const { data: userAgreement, error } = await supabase
      .from('user_agreements')
      .select('*, agreement_versions!inner(*)')
      .eq('user_id', userId)
      .eq('agreement_versions.agreement_type', agreementType)
      .eq('agreement_versions.id', latestVersion.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected if not accepted
      throw error;
    }

    const accepted = !!userAgreement;
    const currentVersion = userAgreement?.agreement_versions?.version;

    const result: AgreementCheckResult = {
      required: true,
      accepted,
      currentVersion,
      latestVersion: latestVersion.version,
      needsReacceptance: !accepted || (currentVersion !== latestVersion.version && latestVersion.isMajorVersion),
      agreementVersion: latestVersion,
    };

    return { success: true, data: result };
  } catch (error) {
    console.error('Error checking user agreement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check agreement',
    };
  }
}

/**
 * Accept a user agreement
 */
export async function acceptUserAgreement(
  input: AgreementAcceptanceInput
): Promise<{ success: boolean; data?: UserAgreement; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    // Get latest version
    const latestVersionResult = await getLatestAgreementVersion(input.agreementType);
    if (!latestVersionResult.success || !latestVersionResult.data) {
      return {
        success: false,
        error: 'No active agreement version found',
      };
    }

    const latestVersion = latestVersionResult.data;

    // Get request info for IP and user agent from metadata
    const ip = input.metadata?.ip;
    const userAgent = input.metadata?.userAgent;
    const timestamp = new Date().toISOString();

    // Enhanced metadata with all tracking information
    const enhancedMetadata = {
      ...(input.metadata || {}),
      ip,
      userAgent,
      timestamp,
      version: latestVersion.version,
      agreementType: input.agreementType,
      acceptanceMethod: 'web',
      deviceInfo: userAgent ? {
        browser: userAgent.includes('Chrome') ? 'Chrome' : userAgent.includes('Firefox') ? 'Firefox' : userAgent.includes('Safari') ? 'Safari' : userAgent.includes('Edge') ? 'Edge' : 'Unknown',
        isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent),
      } : undefined,
    };

    // Insert user agreement
    const { data: userAgreement, error } = await supabase
      .from('user_agreements')
      .insert({
        user_id: input.userId,
        agreement_version_id: latestVersion.id,
        accepted_ip: ip,
        accepted_user_agent: userAgent,
        acceptance_method: 'web',
        signature_text: input.signatureText,
        signature_method: input.signatureMethod || 'typed',
        metadata: enhancedMetadata,
      })
      .select()
      .single();

    if (error) {
      // If already exists, update it
      if (error.code === '23505') {
        const timestamp = new Date().toISOString();
        const enhancedMetadata = {
          ...(input.metadata || {}),
          ip,
          userAgent,
          timestamp,
          version: latestVersion.version,
          agreementType: input.agreementType,
          acceptanceMethod: 'web',
          deviceInfo: userAgent ? {
            browser: userAgent.includes('Chrome') ? 'Chrome' : userAgent.includes('Firefox') ? 'Firefox' : userAgent.includes('Safari') ? 'Safari' : userAgent.includes('Edge') ? 'Edge' : 'Unknown',
            isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent),
          } : undefined,
        };

        const { data: updated, error: updateError } = await supabase
          .from('user_agreements')
          .update({
            accepted_at: timestamp,
            accepted_ip: ip,
            accepted_user_agent: userAgent,
            signature_text: input.signatureText,
            signature_method: input.signatureMethod || 'typed',
            metadata: enhancedMetadata,
          })
          .eq('user_id', input.userId)
          .eq('agreement_version_id', latestVersion.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return { success: true, data: mapUserAgreement(updated) };
      }
      throw error;
    }

    // Update profiles.agreements_accepted JSONB cache
    const { data: profile } = await supabase
      .from('profiles')
      .select('agreements_accepted')
      .eq('id', input.userId)
      .single();

    const agreementsAccepted = (profile?.agreements_accepted as Record<string, any>) || {};
    agreementsAccepted[input.agreementType] = {
      version: latestVersion.version,
      accepted_at: new Date().toISOString(),
      ip,
    };

    await supabase
      .from('profiles')
      .update({ agreements_accepted: agreementsAccepted })
      .eq('id', input.userId);

    return { success: true, data: mapUserAgreement(userAgreement) };
  } catch (error) {
    console.error('Error accepting user agreement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept agreement',
    };
  }
}

/**
 * Accept a warehouse agreement
 */
export async function acceptWarehouseAgreement(
  input: AgreementAcceptanceInput & { warehouseId: string }
): Promise<{ success: boolean; data?: WarehouseAgreement; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    // Get latest version
    const latestVersionResult = await getLatestAgreementVersion(input.agreementType);
    if (!latestVersionResult.success || !latestVersionResult.data) {
      return {
        success: false,
        error: 'No active agreement version found',
      };
    }

    const latestVersion = latestVersionResult.data;

    // Get request info from metadata
    const ip = input.metadata?.ip;
    const userAgent = input.metadata?.userAgent;
    const timestamp = new Date().toISOString();

    // Enhanced metadata with all tracking information
    const enhancedMetadata = {
      ...(input.metadata || {}),
      ip,
      userAgent,
      timestamp,
      version: latestVersion.version,
      agreementType: input.agreementType,
      acceptanceMethod: 'web',
      warehouseId: input.warehouseId,
      deviceInfo: userAgent ? {
        browser: userAgent.includes('Chrome') ? 'Chrome' : userAgent.includes('Firefox') ? 'Firefox' : userAgent.includes('Safari') ? 'Safari' : userAgent.includes('Edge') ? 'Edge' : 'Unknown',
        isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent),
      } : undefined,
    };

    // Insert warehouse agreement
    const { data: warehouseAgreement, error } = await supabase
      .from('warehouse_agreements')
      .insert({
        warehouse_id: input.warehouseId,
        agreement_version_id: latestVersion.id,
        accepted_by: input.userId,
        accepted_ip: ip,
        accepted_user_agent: userAgent,
        signature_text: input.signatureText,
        signature_method: input.signatureMethod || 'typed',
        metadata: enhancedMetadata,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Update if exists
        const timestamp = new Date().toISOString();
        const enhancedMetadata = {
          ...(input.metadata || {}),
          ip,
          userAgent,
          timestamp,
          version: latestVersion.version,
          agreementType: input.agreementType,
          acceptanceMethod: 'web',
          warehouseId: input.warehouseId,
          deviceInfo: userAgent ? {
            browser: userAgent.includes('Chrome') ? 'Chrome' : userAgent.includes('Firefox') ? 'Firefox' : userAgent.includes('Safari') ? 'Safari' : userAgent.includes('Edge') ? 'Edge' : 'Unknown',
            isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent),
          } : undefined,
        };

        const { data: updated, error: updateError } = await supabase
          .from('warehouse_agreements')
          .update({
            accepted_at: timestamp,
            accepted_by: input.userId,
            accepted_ip: ip,
            accepted_user_agent: userAgent,
            signature_text: input.signatureText,
            signature_method: input.signatureMethod || 'typed',
            metadata: enhancedMetadata,
          })
          .eq('warehouse_id', input.warehouseId)
          .eq('agreement_version_id', latestVersion.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return { success: true, data: mapWarehouseAgreement(updated) };
      }
      throw error;
    }

    // Update warehouses.owner_agreements JSONB cache
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('owner_agreements')
      .eq('id', input.warehouseId)
      .single();

    const ownerAgreements = (warehouse?.owner_agreements as Record<string, any>) || {};
    ownerAgreements[input.agreementType] = {
      version: latestVersion.version,
      accepted_at: new Date().toISOString(),
    };

    await supabase
      .from('warehouses')
      .update({ owner_agreements: ownerAgreements })
      .eq('id', input.warehouseId);

    return { success: true, data: mapWarehouseAgreement(warehouseAgreement) };
  } catch (error) {
    console.error('Error accepting warehouse agreement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept agreement',
    };
  }
}

/**
 * Accept a booking agreement
 */
export async function acceptBookingAgreement(
  input: AgreementAcceptanceInput & { bookingId: string }
): Promise<{ success: boolean; data?: BookingAgreement; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    // Get latest version
    const latestVersionResult = await getLatestAgreementVersion(input.agreementType);
    if (!latestVersionResult.success || !latestVersionResult.data) {
      return {
        success: false,
        error: 'No active agreement version found',
      };
    }

    const latestVersion = latestVersionResult.data;

    // Get request info from metadata
    const ip = input.metadata?.ip;
    const userAgent = input.metadata?.userAgent;
    const timestamp = new Date().toISOString();

    // Enhanced metadata with all tracking information
    const enhancedMetadata = {
      ...(input.metadata || {}),
      ip,
      userAgent,
      timestamp,
      version: latestVersion.version,
      agreementType: input.agreementType,
      acceptanceMethod: 'web',
      bookingId: input.bookingId,
      deviceInfo: userAgent ? {
        browser: userAgent.includes('Chrome') ? 'Chrome' : userAgent.includes('Firefox') ? 'Firefox' : userAgent.includes('Safari') ? 'Safari' : userAgent.includes('Edge') ? 'Edge' : 'Unknown',
        isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent),
      } : undefined,
    };

    // Insert booking agreement
    const { data: bookingAgreement, error } = await supabase
      .from('booking_agreements')
      .insert({
        booking_id: input.bookingId,
        agreement_version_id: latestVersion.id,
        accepted_by: input.userId,
        accepted_ip: ip,
        accepted_user_agent: userAgent,
        signature_text: input.signatureText,
        signature_method: input.signatureMethod || 'typed',
        metadata: enhancedMetadata,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Update if exists
        const timestamp = new Date().toISOString();
        const enhancedMetadata = {
          ...(input.metadata || {}),
          ip,
          userAgent,
          timestamp,
          version: latestVersion.version,
          agreementType: input.agreementType,
          acceptanceMethod: 'web',
          bookingId: input.bookingId,
          deviceInfo: userAgent ? {
            browser: userAgent.includes('Chrome') ? 'Chrome' : userAgent.includes('Firefox') ? 'Firefox' : userAgent.includes('Safari') ? 'Safari' : userAgent.includes('Edge') ? 'Edge' : 'Unknown',
            isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent),
          } : undefined,
        };

        const { data: updated, error: updateError } = await supabase
          .from('booking_agreements')
          .update({
            accepted_at: timestamp,
            accepted_by: input.userId,
            accepted_ip: ip,
            accepted_user_agent: userAgent,
            signature_text: input.signatureText,
            signature_method: input.signatureMethod || 'typed',
            metadata: enhancedMetadata,
          })
          .eq('booking_id', input.bookingId)
          .eq('agreement_version_id', latestVersion.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return { success: true, data: mapBookingAgreement(updated) };
      }
      throw error;
    }

    // Update bookings.booking_agreements JSONB cache
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_agreements')
      .eq('id', input.bookingId)
      .single();

    const bookingAgreements = (booking?.booking_agreements as Record<string, any>) || {};
    bookingAgreements[input.agreementType] = {
      version: latestVersion.version,
      accepted_at: new Date().toISOString(),
    };

    await supabase
      .from('bookings')
      .update({ booking_agreements: bookingAgreements })
      .eq('id', input.bookingId);

    return { success: true, data: mapBookingAgreement(bookingAgreement) };
  } catch (error) {
    console.error('Error accepting booking agreement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept agreement',
    };
  }
}

/**
 * Get all agreement statuses for a user
 */
export async function getUserAgreementStatuses(
  userId: string
): Promise<{ success: boolean; data?: AgreementStatus[]; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    // Get all user agreements
    const { data: userAgreements, error } = await supabase
      .from('user_agreements')
      .select('*, agreement_versions!inner(agreement_type, version, is_major_version)')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    // Get latest versions for all agreement types
    const agreementTypes = Object.values(AgreementType);
    const statuses: AgreementStatus[] = [];

    for (const agreementType of agreementTypes) {
      const latestVersionResult = await getLatestAgreementVersion(agreementType);
      if (!latestVersionResult.success || !latestVersionResult.data) continue;

      const latestVersion = latestVersionResult.data;
      const userAgreement = userAgreements?.find(
        (ua: any) => ua.agreement_versions.agreement_type === agreementType
      );

      const accepted = !!userAgreement;
      const needsReacceptance = !accepted || 
        (userAgreement && userAgreement.agreement_versions.version !== latestVersion.version && latestVersion.isMajorVersion);

      statuses.push({
        agreementType,
        version: latestVersion.version,
        accepted,
        acceptedAt: userAgreement ? new Date(userAgreement.accepted_at) : undefined,
        needsReacceptance,
      });
    }

    return { success: true, data: statuses };
  } catch (error) {
    console.error('Error fetching user agreement statuses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch agreement statuses',
    };
  }
}

// Helper functions to map database results to types
function mapUserAgreement(data: any): UserAgreement {
  return {
    id: data.id,
    userId: data.user_id,
    agreementVersionId: data.agreement_version_id,
    acceptedAt: new Date(data.accepted_at),
    acceptedIp: data.accepted_ip,
    acceptedUserAgent: data.accepted_user_agent,
    acceptanceMethod: data.acceptance_method,
    signatureText: data.signature_text,
    signatureMethod: data.signature_method,
    metadata: data.metadata,
    createdAt: new Date(data.created_at),
  };
}

function mapWarehouseAgreement(data: any): WarehouseAgreement {
  return {
    id: data.id,
    warehouseId: data.warehouse_id,
    agreementVersionId: data.agreement_version_id,
    acceptedBy: data.accepted_by,
    acceptedAt: new Date(data.accepted_at),
    acceptedIp: data.accepted_ip,
    acceptedUserAgent: data.accepted_user_agent,
    signatureText: data.signature_text,
    signatureMethod: data.signature_method,
    metadata: data.metadata,
    createdAt: new Date(data.created_at),
  };
}

function mapBookingAgreement(data: any): BookingAgreement {
  return {
    id: data.id,
    bookingId: data.booking_id,
    agreementVersionId: data.agreement_version_id,
    acceptedBy: data.accepted_by,
    acceptedAt: new Date(data.accepted_at),
    acceptedIp: data.accepted_ip,
    acceptedUserAgent: data.accepted_user_agent,
    signatureText: data.signature_text,
    signatureMethod: data.signature_method,
    metadata: data.metadata,
    createdAt: new Date(data.created_at),
  };
}

