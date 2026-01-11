'use server';

/**
 * Contact Management Server Actions
 * Adapted to work with existing CRM system (crm_contacts table)
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  Contact,
  ContactStatus,
  ContactType,
  CreateContactInput,
  CreateSignatureRequestInput,
  SignatureRequest,
  SignatureStatus,
  UpdateContactInput,
} from './types';
import { initializeKolaySignService } from './api/kolaysign-service';

/**
 * Helper to map Contact to crm_contacts format
 */
function mapContactToCRM(contact: any): Contact {
  return {
    id: contact.id,
    contactName: contact.contact_name || '',
    firstName: contact.first_name,
    lastName: contact.last_name,
    email: contact.email,
    phone: contact.phone,
    secondaryPhone: contact.secondary_phone,
    companyName: contact.company_name,
    contactType: contact.contact_type as ContactType,
    status: contact.status as ContactStatus,
    address: contact.address,
    city: contact.city,
    state: contact.state,
    country: contact.country,
    postalCode: contact.postal_code,
    location: contact.location ? {
      type: 'Point',
      coordinates: [contact.location.coordinates[0], contact.location.coordinates[1]],
    } : undefined,
    createdBy: contact.created_by,
    assignedTo: contact.assigned_to,
    companyId: contact.company_id,
    pipelineStage: contact.pipeline_stage,
    pipelineMilestone: contact.pipeline_milestone,
    priority: contact.priority,
    warehouseSizeSqm: contact.warehouse_size_sqm,
    warehouseType: contact.warehouse_type,
    availableServices: contact.available_services,
    estimatedCapacity: contact.estimated_capacity,
    currentUtilizationPercent: contact.current_utilization_percent,
    industry: contact.industry,
    companySize: contact.company_size,
    estimatedSpaceNeedSqm: contact.estimated_space_need_sqm,
    budgetRange: contact.budget_range,
    decisionMakerName: contact.decision_maker_name,
    decisionMakerTitle: contact.decision_maker_title,
    tags: contact.tags,
    customFields: contact.custom_fields,
    notes: contact.notes,
    lastModifiedBy: contact.last_modified_by,
    createdAt: new Date(contact.created_at),
    updatedAt: new Date(contact.updated_at),
    lastContactDate: contact.last_contact_date ? new Date(contact.last_contact_date) : undefined,
    nextFollowUpDate: contact.next_follow_up_date ? new Date(contact.next_follow_up_date) : undefined,
  };
}

/**
 * Create a new contact in CRM
 */
export async function createContact(
  input: CreateContactInput,
  userId: string
): Promise<{ success: boolean; data?: Contact; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    // Generate contact_name if not provided
    const contactName = input.contactName || 
      (input.firstName && input.lastName ? `${input.firstName} ${input.lastName}` : input.firstName || input.lastName || 'Unnamed Contact');

    const contactData: any = {
      contact_name: contactName,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      secondary_phone: input.secondaryPhone,
      company_name: input.companyName,
      contact_type: input.contactType,
      status: ContactStatus.ACTIVE,
      address: input.address,
      city: input.city,
      state: input.state,
      country: input.country,
      postal_code: input.postalCode,
      notes: input.notes,
      created_by: userId,
      assigned_to: input.assignedTo,
      company_id: input.companyId,
      priority: input.priority || 'medium',
      tags: input.tags || [],
      custom_fields: input.customFields || {},
    };

    const { data, error } = await supabase
      .from('crm_contacts')
      .insert([contactData])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data: mapContactToCRM(data) };
  } catch (error) {
    console.error('Error creating contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create contact',
    };
  }
}

/**
 * Get contact by ID
 */
export async function getContact(
  contactId: string
): Promise<{ success: boolean; data?: Contact; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data: mapContactToCRM(data) };
  } catch (error) {
    console.error('Error fetching contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch contact',
    };
  }
}

/**
 * List all contacts with optional filtering
 */
export async function listContacts(
  filters?: {
    contactType?: ContactType;
    status?: ContactStatus;
    company?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ success: boolean; data?: Contact[]; error?: string; total?: number }> {
  try {
    const supabase = createServerSupabaseClient();

    let query = supabase.from('crm_contacts').select('*', { count: 'exact' });

    if (filters?.contactType) {
      query = query.eq('contact_type', filters.contactType);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.company) {
      query = query.ilike('company_name', `%${filters.company}%`);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const contacts = (data || []).map(mapContactToCRM);

    return { success: true, data: contacts, total: count || 0 };
  } catch (error) {
    console.error('Error listing contacts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list contacts',
    };
  }
}

/**
 * Update a contact
 */
export async function updateContact(
  contactId: string,
  input: UpdateContactInput,
  userId: string
): Promise<{ success: boolean; data?: Contact; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    const updateData: any = {};

    if (input.firstName !== undefined) updateData.first_name = input.firstName;
    if (input.lastName !== undefined) updateData.last_name = input.lastName;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.secondaryPhone !== undefined) updateData.secondary_phone = input.secondaryPhone;
    if (input.companyName !== undefined) updateData.company_name = input.companyName;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.state !== undefined) updateData.state = input.state;
    if (input.country !== undefined) updateData.country = input.country;
    if (input.postalCode !== undefined) updateData.postal_code = input.postalCode;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.pipelineStage !== undefined) updateData.pipeline_stage = input.pipelineStage;
    if (input.pipelineMilestone !== undefined) updateData.pipeline_milestone = input.pipelineMilestone;
    if (input.contactName !== undefined) updateData.contact_name = input.contactName;
    else if (input.firstName || input.lastName) {
      // Update contact_name if name fields changed
      const { data: existing } = await supabase
        .from('crm_contacts')
        .select('first_name, last_name')
        .eq('id', contactId)
        .single();
      
      if (existing) {
        const firstName = input.firstName ?? existing.first_name;
        const lastName = input.lastName ?? existing.last_name;
        updateData.contact_name = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Unnamed Contact';
      }
    }

    updateData.last_modified_by = userId;

    const { data, error } = await supabase
      .from('crm_contacts')
      .update(updateData)
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data: mapContactToCRM(data) };
  } catch (error) {
    console.error('Error updating contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update contact',
    };
  }
}

/**
 * Delete a contact
 */
export async function deleteContact(
  contactId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('crm_contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete contact',
    };
  }
}

/**
 * Create a signature request for a contact
 */
export async function createSignatureRequest(
  input: CreateSignatureRequestInput,
  userId: string
): Promise<{ success: boolean; data?: SignatureRequest; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    const kolaySignService = initializeKolaySignService();

    // Get contact details
    const { data: contact, error: contactError } = await supabase
      .from('crm_contacts')
      .select('*')
      .eq('id', input.contactId)
      .single();

    if (contactError || !contact) {
      throw new Error('Contact not found');
    }

    // Get contact email and name
    const contactEmail = contact.email;
    const contactName = contact.contact_name || 
      (contact.first_name && contact.last_name ? `${contact.first_name} ${contact.last_name}` : contact.first_name || contact.last_name || 'Contact');

    if (!contactEmail) {
      throw new Error('Contact email is required for signature requests');
    }

    // Create document in KolaySign
    const kolaySignResponse = await kolaySignService.createSignatureRequest({
      name: input.documentName,
      content: input.documentUrl,
      signers: [
        {
          email: contactEmail,
          name: contactName,
        },
      ],
      metadata: {
        contactId: input.contactId,
        documentId: input.documentId,
        ...input.metadata,
      },
    });

    if (!kolaySignResponse.success) {
      throw new Error(kolaySignResponse.error || 'Failed to create KolaySign document');
    }

    // Create signature request record
    const signatureRequestData: any = {
      contact_id: input.contactId,
      document_id: input.documentId,
      document_name: input.documentName,
      document_url: input.documentUrl,
      status: SignatureStatus.PENDING,
      signing_url: kolaySignResponse.data?.signingUrl,
      expires_at: input.expiresAt.toISOString(),
      created_by: userId,
      kolaysign_request_id: kolaySignResponse.data?.documentId,
      metadata: input.metadata || {},
    };

    const { data: signatureRequest, error: insertError } = await supabase
      .from('signature_requests')
      .insert([signatureRequestData])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Map to SignatureRequest interface
    const mappedRequest: SignatureRequest = {
      id: signatureRequest.id,
      contactId: signatureRequest.contact_id,
      documentId: signatureRequest.document_id,
      documentName: signatureRequest.document_name,
      documentUrl: signatureRequest.document_url,
      status: signatureRequest.status as SignatureStatus,
      signingUrl: signatureRequest.signing_url,
      signedDocumentUrl: signatureRequest.signed_document_url,
      signedAt: signatureRequest.signed_at ? new Date(signatureRequest.signed_at) : undefined,
      expiresAt: new Date(signatureRequest.expires_at),
      createdAt: new Date(signatureRequest.created_at),
      updatedAt: new Date(signatureRequest.updated_at),
      createdBy: signatureRequest.created_by,
      kolaySignRequestId: signatureRequest.kolaysign_request_id,
      kolaySignDocumentId: signatureRequest.kolaysign_document_id,
      metadata: signatureRequest.metadata,
    };

    return { success: true, data: mappedRequest };
  } catch (error) {
    console.error('Error creating signature request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create signature request',
    };
  }
}

/**
 * Get signature request by ID
 */
export async function getSignatureRequest(
  requestId: string
): Promise<{ success: boolean; data?: SignatureRequest; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      throw error;
    }

    const mappedRequest: SignatureRequest = {
      id: data.id,
      contactId: data.contact_id,
      documentId: data.document_id,
      documentName: data.document_name,
      documentUrl: data.document_url,
      status: data.status as SignatureStatus,
      signingUrl: data.signing_url,
      signedDocumentUrl: data.signed_document_url,
      signedAt: data.signed_at ? new Date(data.signed_at) : undefined,
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      kolaySignRequestId: data.kolaysign_request_id,
      kolaySignDocumentId: data.kolaysign_document_id,
      metadata: data.metadata,
    };

    return { success: true, data: mappedRequest };
  } catch (error) {
    console.error('Error fetching signature request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch signature request',
    };
  }
}

/**
 * List signature requests for a contact
 */
export async function listSignatureRequests(
  contactId: string,
  filters?: {
    status?: SignatureStatus;
    limit?: number;
    offset?: number;
  }
): Promise<{ success: boolean; data?: SignatureRequest[]; error?: string; total?: number }> {
  try {
    const supabase = createServerSupabaseClient();

    let query = supabase
      .from('signature_requests')
      .select('*', { count: 'exact' })
      .eq('contact_id', contactId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const requests = (data || []).map((req: any) => ({
      id: req.id,
      contactId: req.contact_id,
      documentId: req.document_id,
      documentName: req.document_name,
      documentUrl: req.document_url,
      status: req.status as SignatureStatus,
      signingUrl: req.signing_url,
      signedDocumentUrl: req.signed_document_url,
      signedAt: req.signed_at ? new Date(req.signed_at) : undefined,
      expiresAt: new Date(req.expires_at),
      createdAt: new Date(req.created_at),
      updatedAt: new Date(req.updated_at),
      createdBy: req.created_by,
      kolaySignRequestId: req.kolaysign_request_id,
      kolaySignDocumentId: req.kolaysign_document_id,
      metadata: req.metadata,
    }));

    return { success: true, data: requests, total: count || 0 };
  } catch (error) {
    console.error('Error listing signature requests:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list signature requests',
    };
  }
}

/**
 * Update signature request status
 */
export async function updateSignatureRequestStatus(
  requestId: string,
  status: SignatureStatus,
  signedDocumentUrl?: string
): Promise<{ success: boolean; data?: SignatureRequest; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();

    const updateData: any = {
      status,
    };

    if (signedDocumentUrl) {
      updateData.signed_document_url = signedDocumentUrl;
      updateData.signed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('signature_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const mappedRequest: SignatureRequest = {
      id: data.id,
      contactId: data.contact_id,
      documentId: data.document_id,
      documentName: data.document_name,
      documentUrl: data.document_url,
      status: data.status as SignatureStatus,
      signingUrl: data.signing_url,
      signedDocumentUrl: data.signed_document_url,
      signedAt: data.signed_at ? new Date(data.signed_at) : undefined,
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      kolaySignRequestId: data.kolaysign_request_id,
      kolaySignDocumentId: data.kolaysign_document_id,
      metadata: data.metadata,
    };

    return { success: true, data: mappedRequest };
  } catch (error) {
    console.error('Error updating signature request status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update signature request',
    };
  }
}

/**
 * Cancel a signature request
 */
export async function cancelSignatureRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    const kolaySignService = initializeKolaySignService();

    // Get signature request
    const { data: signatureRequest, error: fetchError } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !signatureRequest) {
      throw new Error('Signature request not found');
    }

    // Cancel in KolaySign
    if (signatureRequest.kolaysign_request_id) {
      await kolaySignService.cancelSignatureRequest(signatureRequest.kolaysign_request_id);
    }

    // Update status
    const { error: updateError } = await supabase
      .from('signature_requests')
      .update({
        status: SignatureStatus.CANCELLED,
      })
      .eq('id', requestId);

    if (updateError) {
      throw updateError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error cancelling signature request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel signature request',
    };
  }
}

/**
 * Resend signing invitation
 */
export async function resendSigningInvitation(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    const kolaySignService = initializeKolaySignService();

    // Get signature request
    const { data: signatureRequest, error: fetchError } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !signatureRequest) {
      throw new Error('Signature request not found');
    }

    // Get contact
    const { data: contact, error: contactError } = await supabase
      .from('crm_contacts')
      .select('email, contact_name, first_name, last_name')
      .eq('id', signatureRequest.contact_id)
      .single();

    if (contactError || !contact) {
      throw new Error('Contact not found');
    }

    const contactEmail = contact.email;
    if (!contactEmail) {
      throw new Error('Contact email is required');
    }

    // Resend in KolaySign
    if (signatureRequest.kolaysign_request_id) {
      const response = await kolaySignService.resendSigningInvitation(
        signatureRequest.kolaysign_request_id,
        contactEmail
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to resend signing invitation');
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error resending signing invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resend signing invitation',
    };
  }
}

