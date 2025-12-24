/**
 * Event System - Main Export
 */

export { EventEmitter, getEventEmitter, resetEventEmitter } from './event-emitter'
export { registerEventHandlers } from './event-handlers'
export type {
  EventType,
  EntityType,
  EventStatus,
  EventPayload,
  EventHandler,
  EventSubscription,
  EventEmitterOptions,
  BaseEventPayload,
  BookingRequestedPayload,
  BookingProposalCreatedPayload,
  BookingProposalAcceptedPayload,
  BookingProposalRejectedPayload,
  BookingApprovedPayload,
  BookingRejectedPayload,
  BookingModifiedPayload,
  InvoiceGeneratedPayload,
  InvoicePaidPayload,
  InvoiceOverduePayload,
  WarehouseOccupancyUpdatedPayload,
  TeamMemberInvitedPayload,
  TeamMemberJoinedPayload,
} from './types'

