/**
 * Agreement Management Types
 * Defines all TypeScript types for the agreement management system
 */

export enum AgreementType {
  // User Agreements
  TERMS_OF_SERVICE = 'tos',
  PRIVACY_POLICY = 'privacy_policy',
  COOKIE_POLICY = 'cookie_policy',
  PAYMENT_PROCESSING = 'payment_processing',
  DATA_PROCESSING = 'dpa',
  NON_DISCLOSURE = 'nda',
  
  // Warehouse Owner Agreements
  WAREHOUSE_OWNER_SERVICE = 'warehouse_owner_service',
  SERVICE_LEVEL_AGREEMENT = 'sla',
  INSURANCE_LIABILITY = 'insurance_liability',
  CONTENT_LISTING = 'content_listing',
  
  // Booking Agreements
  CUSTOMER_BOOKING = 'customer_booking',
  CANCELLATION_REFUND = 'cancellation_refund',
  ESCROW = 'escrow',
  RESELLER_CUSTOMER = 'reseller_customer',
  
  // Role-Specific Agreements
  RESELLER_PARTNERSHIP = 'reseller_partnership',
  WAREHOUSE_FINDER = 'warehouse_finder',
  AFFILIATE_MARKETING = 'affiliate_marketing',
  
  // Platform Policies
  REVIEW_RATING = 'review_rating',
  ANTI_DISCRIMINATION = 'anti_discrimination',
  DISPUTE_RESOLUTION = 'dispute_resolution',
}

export enum AgreementScope {
  USER = 'user',
  WAREHOUSE = 'warehouse',
  BOOKING = 'booking',
  ROLE = 'role',
}

export interface AgreementVersion {
  id: string;
  agreementType: AgreementType;
  version: string; // Format: MAJOR.MINOR (e.g., "1.0", "1.1", "2.0")
  title: string;
  content: string; // Markdown content
  pdfUrl?: string;
  isMajorVersion: boolean;
  effectiveDate: Date;
  expiryDate?: Date;
  language: string;
  isActive: boolean;
  isDraft: boolean;
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
}

export interface UserAgreement {
  id: string;
  userId: string;
  agreementVersionId: string;
  acceptedAt: Date;
  acceptedIp?: string;
  acceptedUserAgent?: string;
  acceptanceMethod: 'web' | 'mobile_app' | 'api';
  signatureText?: string;
  signatureMethod: 'typed' | 'kolaysign' | 'eid';
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface WarehouseAgreement {
  id: string;
  warehouseId: string;
  agreementVersionId: string;
  acceptedBy: string;
  acceptedAt: Date;
  acceptedIp?: string;
  acceptedUserAgent?: string;
  signatureText?: string;
  signatureMethod: 'typed' | 'kolaysign' | 'eid';
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface BookingAgreement {
  id: string;
  bookingId: string;
  agreementVersionId: string;
  acceptedBy: string;
  acceptedAt: Date;
  acceptedIp?: string;
  acceptedUserAgent?: string;
  signatureText?: string;
  signatureMethod: 'typed' | 'kolaysign' | 'eid';
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface AgreementAcceptanceInput {
  agreementType: AgreementType;
  userId: string;
  signatureText?: string;
  signatureMethod?: 'typed' | 'kolaysign' | 'eid';
  metadata?: Record<string, any>;
  // Context-specific IDs
  warehouseId?: string;
  bookingId?: string;
}

export interface AgreementCheckResult {
  required: boolean;
  accepted: boolean;
  currentVersion?: string;
  latestVersion?: string;
  needsReacceptance: boolean;
  agreementVersion?: AgreementVersion;
}

export interface AgreementStatus {
  agreementType: AgreementType;
  version: string;
  accepted: boolean;
  acceptedAt?: Date;
  needsReacceptance: boolean;
}

