/**
 * Notification Event Processor
 * Processes notification events from the queue and creates notifications
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getNotificationService } from './service'
import type { EventPayload } from '@/lib/events/types'

export interface ProcessedEvent {
  id: string
  eventType: string
  entityType: string
  entityId: string
  status: 'completed' | 'failed'
  error?: string
}

/**
 * Process a single notification event
 */
export async function processNotificationEvent(
  eventId: string
): Promise<ProcessedEvent> {
  const supabase = await createServerSupabaseClient()

  let event: any = null

  try {
    // Fetch the event
    const { data: fetchedEvent, error: fetchError } = await supabase
      .from('notification_events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (fetchError || !fetchedEvent) {
      throw new Error(`Event not found: ${eventId}`)
    }

    event = fetchedEvent

    // Check if already processed
    if (event.status === 'completed') {
      return {
        id: event.id,
        eventType: event.event_type,
        entityType: event.entity_type,
        entityId: event.entity_id,
        status: 'completed',
      }
    }

    // Mark as processing
    await supabase
      .from('notification_events')
      .update({ status: 'processing' })
      .eq('id', eventId)

    const payload = event.payload as EventPayload

    // Determine recipients based on event type
    const recipients = await determineRecipients(payload, supabase)

    if (recipients.length === 0) {
      // No recipients, mark as completed
      await supabase
        .from('notification_events')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', eventId)

      return {
        id: event.id,
        eventType: event.event_type,
        entityType: event.entity_type,
        entityId: event.entity_id,
        status: 'completed',
      }
    }

    // Create notifications for each recipient
    const notificationService = getNotificationService()
    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const notificationOptions = await buildNotificationOptions(
          payload,
          recipient.userId
        )

        if (notificationOptions) {
          return await notificationService.sendNotification(notificationOptions)
        }
        return null
      })
    )

    // Check for failures
    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      const errorMessage = failures
        .map((f) => (f.status === 'rejected' ? String(f.reason) : ''))
        .join('; ')

      // Update event with error
      await supabase
        .from('notification_events')
        .update({
          status: 'failed',
          error_message: errorMessage,
          retry_count: event.retry_count + 1,
        })
        .eq('id', eventId)

      return {
        id: event.id,
        eventType: event.event_type,
        entityType: event.entity_type,
        entityId: event.entity_id,
        status: 'failed',
        error: errorMessage,
      }
    }

    // Mark as completed
    await supabase
      .from('notification_events')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', eventId)

    return {
      id: event.id,
      eventType: event.event_type,
      entityType: event.entity_type,
      entityId: event.entity_id,
      status: 'completed',
    }
  } catch (error) {
    // Update event with error
    try {
      await supabase
        .from('notification_events')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
          retry_count: (event?.retry_count || 0) + 1,
        })
        .eq('id', eventId)
    } catch (updateError) {
      // Ignore update errors
    }

    return {
      id: eventId,
      eventType: 'unknown',
      entityType: 'unknown',
      entityId: '',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Determine recipients for an event
 */
async function determineRecipients(
  payload: EventPayload,
  supabase: any
): Promise<Array<{ userId: string; role?: string }>> {
  const recipients: Array<{ userId: string; role?: string }> = []

  switch (payload.eventType) {
    case 'booking.requested': {
      // Notify warehouse owner
      if ('warehouseOwnerId' in payload && payload.warehouseOwnerId) {
        recipients.push({ userId: payload.warehouseOwnerId })
      }
      break
    }

    case 'booking.proposal.created': {
      // Notify customer
      if ('customerId' in payload && payload.customerId) {
        recipients.push({ userId: payload.customerId })
      }
      break
    }

    case 'booking.proposal.accepted':
    case 'booking.proposal.rejected': {
      // Notify warehouse owner
      if ('warehouseOwnerId' in payload && payload.warehouseOwnerId) {
        recipients.push({ userId: payload.warehouseOwnerId })
      }
      break
    }

    case 'booking.approved': {
      // Notify customer
      if ('customerId' in payload && payload.customerId) {
        recipients.push({ userId: payload.customerId })
      }

      // Notify warehouse staff
      if ('warehouseStaffIds' in payload && payload.warehouseStaffIds) {
        for (const staffId of payload.warehouseStaffIds) {
          recipients.push({ userId: staffId })
        }
      }
      break
    }

    case 'booking.rejected': {
      // Notify customer
      if ('customerId' in payload && payload.customerId) {
        recipients.push({ userId: payload.customerId })
      }
      break
    }

    case 'booking.modified': {
      // Notify warehouse owner
      if ('warehouseOwnerId' in payload && payload.warehouseOwnerId) {
        recipients.push({ userId: payload.warehouseOwnerId })
      }
      break
    }

    case 'invoice.generated':
    case 'invoice.overdue': {
      // Notify customer
      if ('customerId' in payload && payload.customerId) {
        recipients.push({ userId: payload.customerId })
      }
      break
    }

    case 'invoice.paid': {
      // Notify customer
      if ('customerId' in payload && payload.customerId) {
        recipients.push({ userId: payload.customerId })
      }
      break
    }

    case 'warehouse.occupancy.updated': {
      // Notify warehouse owner
      if ('warehouseOwnerId' in payload && payload.warehouseOwnerId) {
        recipients.push({ userId: payload.warehouseOwnerId })
      }
      break
    }

    case 'team.member.invited': {
      // Email will be sent directly, no in-app notification needed
      // But we can notify the inviter
      if ('invitedBy' in payload && payload.invitedBy) {
        recipients.push({ userId: payload.invitedBy })
      }
      break
    }

    case 'team.member.joined': {
      // Notify company admins (from profiles table)
      if ('companyId' in payload && payload.companyId) {
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('company_id', payload.companyId)
          .in('role', ['owner', 'admin'])

        if (admins) {
          for (const admin of admins) {
            recipients.push({ userId: admin.id })
          }
        }
      }
      break
    }
  }

  return recipients
}

/**
 * Build notification options for a recipient
 */
async function buildNotificationOptions(
  payload: EventPayload,
  userId: string
): Promise<any | null> {
  let title = ''
  let message = ''
  let type: 'booking' | 'invoice' | 'task' | 'incident' | 'system' = 'system'

  switch (payload.eventType) {
    case 'booking.requested':
      title = 'New Booking Request'
      message = 'You have received a new booking request'
      type = 'booking'
      break

    case 'booking.proposal.created':
      title = 'Price Proposal Received'
      message = 'A price proposal has been created for your booking request'
      type = 'booking'
      break

    case 'booking.proposal.accepted':
      title = 'Proposal Accepted'
      message = 'Your price proposal has been accepted'
      type = 'booking'
      break

    case 'booking.proposal.rejected':
      title = 'Proposal Rejected'
      message = 'Your price proposal has been rejected'
      type = 'booking'
      break

    case 'booking.approved':
      title = 'Booking Approved'
      message = 'Your booking request has been approved'
      type = 'booking'
      break

    case 'booking.rejected':
      title = 'Booking Rejected'
      message = 'Your booking request has been rejected'
      type = 'booking'
      break

    case 'booking.modified':
      title = 'Booking Modified'
      message = 'A booking modification has been requested'
      type = 'booking'
      break

    case 'invoice.generated':
      title = 'New Invoice Generated'
      message = 'A new invoice has been generated for your booking'
      type = 'invoice'
      break

    case 'invoice.paid':
      title = 'Invoice Paid'
      message = 'Your invoice has been paid'
      type = 'invoice'
      break

    case 'invoice.overdue':
      title = 'Invoice Overdue'
      message = 'Your invoice is overdue. Please make payment as soon as possible.'
      type = 'invoice'
      break

    case 'warehouse.occupancy.updated':
      if ('occupancyPercent' in payload && payload.occupancyPercent >= 90) {
        title = 'High Warehouse Occupancy'
        message = `Warehouse occupancy is at ${payload.occupancyPercent}%`
        type = 'system'
      } else {
        // Don't notify for normal occupancy updates
        return null
      }
      break

    case 'team.member.invited':
      title = 'Team Member Invited'
      message = 'A team member invitation has been sent'
      type = 'system'
      break

    case 'team.member.joined':
      title = 'Team Member Joined'
      message = 'A new team member has joined your company'
      type = 'system'
      break

    default:
      return null
  }

  return {
    userId,
    type,
    channels: ['email', 'push'] as const,
    title,
    message,
    metadata: {
      eventType: payload.eventType,
      entityType: payload.entityType,
      entityId: payload.entityId,
    },
  }
}

/**
 * Process pending notification events
 * This function processes events in batches
 */
export async function processPendingEvents(
  batchSize: number = 10
): Promise<ProcessedEvent[]> {
  const supabase = await createServerSupabaseClient()

  // Fetch pending events
  const { data: events, error } = await supabase
    .from('notification_events')
    .select('*')
    .eq('status', 'pending')
    .lt('retry_count', 3) // Don't retry events that have failed 3+ times
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (error || !events || events.length === 0) {
    return []
  }

  // Process each event
  const results = await Promise.all(
    events.map((event) => processNotificationEvent(event.id))
  )

  return results
}

