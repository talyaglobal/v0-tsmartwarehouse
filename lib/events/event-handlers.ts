/**
 * Event Handlers
 * Handlers for various event types in the warehouse marketplace system
 */

import { getEventEmitter } from './event-emitter'
import type {
  EventPayload,
  BookingRequestedPayload,
  BookingProposalCreatedPayload,
  BookingApprovedPayload,
  InvoiceGeneratedPayload,
  WarehouseOccupancyUpdatedPayload,
  TeamMemberInvitedPayload,
} from './types'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Register all event handlers
 * This function should be called during application initialization
 */
export function registerEventHandlers(): void {
  const emitter = getEventEmitter()

  // Booking requested - notify warehouse owner
  emitter.on('booking.requested', handleBookingRequested, 10)

  // Booking proposal created - notify customer
  emitter.on('booking.proposal.created', handleBookingProposalCreated, 10)

  // Booking proposal accepted - notify warehouse owner
  emitter.on('booking.proposal.accepted', handleBookingProposalAccepted, 10)

  // Booking proposal rejected - notify warehouse owner
  emitter.on('booking.proposal.rejected', handleBookingProposalRejected, 10)

  // Booking approved - notify customer and warehouse staff
  emitter.on('booking.approved', handleBookingApproved, 10)

  // Booking rejected - notify customer
  emitter.on('booking.rejected', handleBookingRejected, 10)

  // Booking modified - notify relevant parties
  emitter.on('booking.modified', handleBookingModified, 10)

  // Invoice generated - notify customer
  emitter.on('invoice.generated', handleInvoiceGenerated, 10)

  // Invoice paid - notify customer and warehouse owner
  emitter.on('invoice.paid', handleInvoicePaid, 10)

  // Invoice overdue - notify customer
  emitter.on('invoice.overdue', handleInvoiceOverdue, 10)

  // Warehouse occupancy updated - notify warehouse owner
  emitter.on('warehouse.occupancy.updated', handleWarehouseOccupancyUpdated, 5)

  // Team member invited - send invitation email
  emitter.on('team.member.invited', handleTeamMemberInvited, 10)

  // Team member joined - notify company admin
  emitter.on('team.member.joined', handleTeamMemberJoined, 10)
}

/**
 * Handle booking requested event
 * Creates notification event in database for warehouse owner
 */
async function handleBookingRequested(payload: BookingRequestedPayload): Promise<void> {
  const supabase = await createServerSupabaseClient()

  // Create notification event in database
  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.bookingId,
    payload: payload,
    status: 'pending',
  })

  // Also create direct notification for warehouse owner
  await supabase.from('notifications').insert({
    user_id: payload.warehouseOwnerId,
    type: 'booking',
    channel: 'email',
    title: 'New Booking Request',
    message: `New booking request received for warehouse ${payload.warehouseId}`,
    read: false,
  })
}

/**
 * Handle booking proposal created event
 * Creates notification event in database for customer
 */
async function handleBookingProposalCreated(
  payload: BookingProposalCreatedPayload
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.proposalId,
    payload: payload,
    status: 'pending',
  })

  await supabase.from('notifications').insert({
    user_id: payload.customerId,
    type: 'booking',
    channel: 'email',
    title: 'Price Proposal Received',
    message: `A price proposal has been created for your booking request`,
    read: false,
  })
}

/**
 * Handle booking proposal accepted event
 */
async function handleBookingProposalAccepted(
  payload: BookingProposalCreatedPayload
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.proposalId,
    payload: payload,
    status: 'pending',
  })

  await supabase.from('notifications').insert({
    user_id: payload.warehouseOwnerId,
    type: 'booking',
    channel: 'email',
    title: 'Proposal Accepted',
    message: `Your price proposal has been accepted`,
    read: false,
  })
}

/**
 * Handle booking proposal rejected event
 */
async function handleBookingProposalRejected(
  payload: BookingProposalCreatedPayload
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.proposalId,
    payload: payload,
    status: 'pending',
  })

  await supabase.from('notifications').insert({
    user_id: payload.warehouseOwnerId,
    type: 'booking',
    channel: 'email',
    title: 'Proposal Rejected',
    message: `Your price proposal has been rejected`,
    read: false,
  })
}

/**
 * Handle booking approved event
 * Notifies customer and warehouse staff
 */
async function handleBookingApproved(payload: BookingApprovedPayload): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.bookingId,
    payload: payload,
    status: 'pending',
  })

  // Notify customer
  await supabase.from('notifications').insert({
    user_id: payload.customerId,
    type: 'booking',
    channel: 'email',
    title: 'Booking Approved',
    message: `Your booking request has been approved`,
    read: false,
  })

  // Notify warehouse staff if any
  if (payload.warehouseStaffIds && payload.warehouseStaffIds.length > 0) {
    const staffNotifications = payload.warehouseStaffIds.map((staffId) => ({
      user_id: staffId,
      type: 'booking',
      channel: 'email',
      title: 'New Booking Assigned',
      message: `A new booking has been assigned to your warehouse`,
      read: false,
    }))

    await supabase.from('notifications').insert(staffNotifications)
  }
}

/**
 * Handle booking rejected event
 */
async function handleBookingRejected(payload: BookingApprovedPayload): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.bookingId,
    payload: payload,
    status: 'pending',
  })

  await supabase.from('notifications').insert({
    user_id: payload.customerId,
    type: 'booking',
    channel: 'email',
    title: 'Booking Rejected',
    message: `Your booking request has been rejected`,
    read: false,
  })
}

/**
 * Handle booking modified event
 */
async function handleBookingModified(payload: EventPayload): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    payload: payload,
    status: 'pending',
  })
}

/**
 * Handle invoice generated event
 */
async function handleInvoiceGenerated(payload: InvoiceGeneratedPayload): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.invoiceId,
    payload: payload,
    status: 'pending',
  })

  await supabase.from('notifications').insert({
    user_id: payload.customerId,
    type: 'invoice',
    channel: 'email',
    title: 'New Invoice Generated',
    message: `A new invoice has been generated for your booking`,
    read: false,
  })
}

/**
 * Handle invoice paid event
 */
async function handleInvoicePaid(payload: InvoiceGeneratedPayload): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.invoiceId,
    payload: payload,
    status: 'pending',
  })
}

/**
 * Handle invoice overdue event
 */
async function handleInvoiceOverdue(payload: InvoiceGeneratedPayload): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.invoiceId,
    payload: payload,
    status: 'pending',
  })

  await supabase.from('notifications').insert({
    user_id: payload.customerId,
    type: 'invoice',
    channel: 'email',
    title: 'Invoice Overdue',
    message: `Your invoice is overdue. Please make payment as soon as possible.`,
    read: false,
  })
}

/**
 * Handle warehouse occupancy updated event
 */
async function handleWarehouseOccupancyUpdated(
  payload: WarehouseOccupancyUpdatedPayload
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.warehouseId,
    payload: payload,
    status: 'pending',
  })

  // Optional: Only notify if occupancy is critical (e.g., > 90%)
  if (payload.occupancyPercent >= 90) {
    await supabase.from('notifications').insert({
      user_id: payload.warehouseOwnerId,
      type: 'system',
      channel: 'email',
      title: 'High Warehouse Occupancy',
      message: `Warehouse occupancy is at ${payload.occupancyPercent}%`,
      read: false,
    })
  }
}

/**
 * Handle team member invited event
 */
async function handleTeamMemberInvited(payload: TeamMemberInvitedPayload): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.invitationId,
    payload: payload,
    status: 'pending',
  })

  // Email will be sent by the email queue system
}

/**
 * Handle team member joined event
 */
async function handleTeamMemberJoined(payload: EventPayload): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notification_events').insert({
    event_type: payload.eventType,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    payload: payload,
    status: 'pending',
  })
}

