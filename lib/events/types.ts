/**
 * Event System Types
 * Type-safe event definitions for the warehouse marketplace system
 */

/**
 * Event types for the system
 */
export type EventType =
  // Booking events
  | 'booking.requested'
  | 'booking.proposal.created'
  | 'booking.proposal.accepted'
  | 'booking.proposal.rejected'
  | 'booking.approved'
  | 'booking.rejected'
  | 'booking.modified'
  | 'booking.cancelled'
  // Invoice events
  | 'invoice.generated'
  | 'invoice.paid'
  | 'invoice.overdue'
  // Warehouse events
  | 'warehouse.occupancy.updated'
  | 'warehouse.created'
  | 'warehouse.updated'
  // Team events
  | 'team.member.invited'
  | 'team.member.joined'
  | 'team.member.removed'
  // System events
  | 'system.maintenance'
  | 'system.alert'

/**
 * Entity types that events can be associated with
 */
export type EntityType =
  | 'booking'
  | 'invoice'
  | 'warehouse'
  | 'company'
  | 'user'
  | 'proposal'
  | 'modification'
  | 'team_member'
  | 'invitation'

/**
 * Event status
 */
export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * Base event payload structure
 */
export interface BaseEventPayload {
  eventType: EventType
  entityType: EntityType
  entityId: string
  timestamp: string
  userId?: string
  companyId?: string
  metadata?: Record<string, any>
}

/**
 * Specific event payloads
 */
export interface BookingRequestedPayload extends BaseEventPayload {
  eventType: 'booking.requested'
  entityType: 'booking'
  bookingId: string
  customerId: string
  warehouseId: string
  warehouseOwnerId: string
  bookingType: 'pallet' | 'area-rental'
  palletCount?: number
  areaSqFt?: number
}

export interface BookingProposalCreatedPayload extends BaseEventPayload {
  eventType: 'booking.proposal.created'
  entityType: 'proposal'
  proposalId: string
  bookingId: string
  customerId: string
  warehouseOwnerId: string
  proposedPrice: number
  expiresAt: string
}

export interface BookingProposalAcceptedPayload extends BaseEventPayload {
  eventType: 'booking.proposal.accepted'
  entityType: 'proposal'
  proposalId: string
  bookingId: string
  customerId: string
  warehouseOwnerId: string
}

export interface BookingProposalRejectedPayload extends BaseEventPayload {
  eventType: 'booking.proposal.rejected'
  entityType: 'proposal'
  proposalId: string
  bookingId: string
  customerId: string
  warehouseOwnerId: string
  reason?: string
}

export interface BookingApprovedPayload extends BaseEventPayload {
  eventType: 'booking.approved'
  entityType: 'booking'
  bookingId: string
  customerId: string
  warehouseId: string
  warehouseOwnerId: string
  warehouseStaffIds?: string[]
}

export interface BookingRejectedPayload extends BaseEventPayload {
  eventType: 'booking.rejected'
  entityType: 'booking'
  bookingId: string
  customerId: string
  warehouseOwnerId: string
  reason?: string
}

export interface BookingModifiedPayload extends BaseEventPayload {
  eventType: 'booking.modified'
  entityType: 'modification'
  modificationId: string
  bookingId: string
  customerId: string
  warehouseOwnerId: string
  modificationType: 'add_pallets' | 'remove_pallets' | 'add_area' | 'remove_area' | 'extend' | 'reduce'
  oldValue?: number
  newValue?: number
}

export interface InvoiceGeneratedPayload extends BaseEventPayload {
  eventType: 'invoice.generated'
  entityType: 'invoice'
  invoiceId: string
  bookingId: string
  customerId: string
  amount: number
  dueDate: string
}

export interface InvoicePaidPayload extends BaseEventPayload {
  eventType: 'invoice.paid'
  entityType: 'invoice'
  invoiceId: string
  bookingId: string
  customerId: string
  amount: number
  paidAt: string
}

export interface InvoiceOverduePayload extends BaseEventPayload {
  eventType: 'invoice.overdue'
  entityType: 'invoice'
  invoiceId: string
  bookingId: string
  customerId: string
  amount: number
  dueDate: string
  daysOverdue: number
}

export interface WarehouseOccupancyUpdatedPayload extends BaseEventPayload {
  eventType: 'warehouse.occupancy.updated'
  entityType: 'warehouse'
  warehouseId: string
  warehouseOwnerId: string
  occupancyPercent: number
  availableSqFt: number
  occupiedSqFt: number
  updatedBy: string
}

export interface TeamMemberInvitedPayload extends BaseEventPayload {
  eventType: 'team.member.invited'
  entityType: 'invitation'
  invitationId: string
  companyId: string
  invitedEmail: string
  invitedBy: string
  role: 'warehouse_admin' | 'warehouse_supervisor' | 'warehouse_client'
}

export interface TeamMemberJoinedPayload extends BaseEventPayload {
  eventType: 'team.member.joined'
  entityType: 'team_member'
  memberId: string
  companyId: string
  userId: string
  role: 'warehouse_admin' | 'warehouse_supervisor' | 'warehouse_client'
}

/**
 * Union type for all event payloads
 */
export type EventPayload =
  | BookingRequestedPayload
  | BookingProposalCreatedPayload
  | BookingProposalAcceptedPayload
  | BookingProposalRejectedPayload
  | BookingApprovedPayload
  | BookingRejectedPayload
  | BookingModifiedPayload
  | InvoiceGeneratedPayload
  | InvoicePaidPayload
  | InvoiceOverduePayload
  | WarehouseOccupancyUpdatedPayload
  | TeamMemberInvitedPayload
  | TeamMemberJoinedPayload

/**
 * Event handler function type
 */
export type EventHandler<T extends EventPayload = EventPayload> = (
  payload: T
) => Promise<void> | void

/**
 * Event subscription
 */
export interface EventSubscription {
  id: string
  eventType: EventType
  handler: EventHandler
  priority?: number
}

/**
 * Event emitter options
 */
export interface EventEmitterOptions {
  maxListeners?: number
  enableLogging?: boolean
}

