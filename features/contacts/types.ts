/**
 * Contact Management Types
 * Adapted to work with existing CRM system (crm_contacts table)
 */

export enum ContactType {
  // CRM Types
  WAREHOUSE_SUPPLIER = 'warehouse_supplier',
  CUSTOMER_LEAD = 'customer_lead',
  // Contact Management Types
  CUSTOMER = 'CUSTOMER',
  SUPPLIER = 'SUPPLIER',
  WAREHOUSE_OWNER = 'WAREHOUSE_OWNER',
  RESELLER = 'RESELLER',
  WAREHOUSE_FINDER = 'WAREHOUSE_FINDER',
  PARTNER = 'PARTNER',
  EMPLOYEE = 'EMPLOYEE',
  OTHER = 'OTHER',
}

export enum ContactStatus {
  // CRM Statuses
  ACTIVE = 'active',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CONVERTED = 'converted',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
  // Contact Management Statuses (distinct values)
  PENDING = 'pending',
  BLOCKED = 'blocked',
}

export enum SignatureStatus {
  PENDING = 'PENDING',
  SIGNED = 'SIGNED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

/**
 * Contact interface adapted for crm_contacts table
 */
export interface Contact {
  id: string;
  // Basic Information
  contactName: string; // Maps to contact_name in crm_contacts
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  secondaryPhone?: string;
  companyName?: string; // Maps to company_name
  
  // Contact Type and Status
  contactType: ContactType;
  status: ContactStatus;
  
  // Location
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  
  // CRM Fields
  createdBy: string;
  assignedTo?: string;
  companyId?: string;
  pipelineStage?: number;
  pipelineMilestone?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  
  // Warehouse Details (for warehouse_supplier)
  warehouseSizeSqm?: number;
  warehouseType?: string[];
  availableServices?: string[];
  estimatedCapacity?: number;
  currentUtilizationPercent?: number;
  
  // Customer Details (for customer_lead)
  industry?: string;
  companySize?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  estimatedSpaceNeedSqm?: number;
  budgetRange?: string;
  decisionMakerName?: string;
  decisionMakerTitle?: string;
  
  // Metadata
  tags?: string[];
  customFields?: Record<string, any>;
  notes?: string;
  lastModifiedBy?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastContactDate?: Date;
  nextFollowUpDate?: Date;
}

export interface SignatureRequest {
  id: string;
  contactId: string;
  documentId: string;
  documentName: string;
  documentUrl: string;
  status: SignatureStatus;
  signingUrl?: string;
  signedDocumentUrl?: string;
  signedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  kolaySignRequestId?: string;
  kolaySignDocumentId?: string;
  metadata?: Record<string, any>;
}

export interface KolaySignConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  webhookSecret?: string;
}

export interface KolaySignDocument {
  id?: string;
  name: string;
  content: string;
  signers: Array<{
    email: string;
    name: string;
    order?: number;
  }>;
  metadata?: Record<string, any>;
}

export interface KolaySignResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export interface CreateContactInput {
  contactName?: string; // If not provided, will be generated from firstName + lastName
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  secondaryPhone?: string;
  companyName?: string;
  contactType: ContactType;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  notes?: string;
  // CRM specific
  assignedTo?: string;
  companyId?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface UpdateContactInput extends Partial<CreateContactInput> {
  status?: ContactStatus;
  pipelineStage?: number;
  pipelineMilestone?: string;
}

export interface CreateSignatureRequestInput {
  contactId: string;
  documentId: string;
  documentName: string;
  documentUrl: string;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface SignatureWebhookPayload {
  event: 'signed' | 'rejected' | 'expired';
  requestId: string;
  kolaySignRequestId: string;
  documentId: string;
  signedAt?: Date;
  signedDocumentUrl?: string;
  reason?: string;
}

