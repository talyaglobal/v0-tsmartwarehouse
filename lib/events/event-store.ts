// Event Sourcing - Domain Events and Event Store
// Provides immutable event storage for audit trails and state replay

export type EventType =
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.completed"
  | "booking.updated"
  | "payment.received"
  | "payment.refunded"
  | "invoice.created"
  | "invoice.paid"
  | "incident.reported"
  | "incident.resolved"
  | "claim.submitted"
  | "claim.approved"
  | "claim.denied"
  | "task.created"
  | "task.assigned"
  | "task.completed"
  | "inventory.received"
  | "inventory.shipped"
  | "user.created"
  | "user.updated"
  | "user.deactivated"

export interface DomainEvent<T = Record<string, unknown>> {
  id: string
  type: EventType
  aggregateId: string
  aggregateType: "booking" | "payment" | "invoice" | "incident" | "claim" | "task" | "inventory" | "user"
  version: number
  payload: T
  metadata: EventMetadata
  occurredAt: string
  correlationId: string
  causationId?: string
}

export interface EventMetadata {
  userId: string
  userRole: string
  ipAddress?: string
  userAgent?: string
  requestId: string
  source: "web" | "api" | "worker" | "system"
}

// In-memory event store for demo (replace with persistent storage in production)
class EventStore {
  private events: DomainEvent[] = []
  private subscribers: Map<EventType | "*", ((event: DomainEvent) => void)[]> = new Map()

  async append(event: Omit<DomainEvent, "id" | "occurredAt">): Promise<DomainEvent> {
    const fullEvent: DomainEvent = {
      ...event,
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    }

    this.events.push(fullEvent)
    await this.publish(fullEvent)

    return fullEvent
  }

  async getEvents(aggregateId: string, aggregateType?: string): Promise<DomainEvent[]> {
    return this.events.filter(
      (e) => e.aggregateId === aggregateId && (!aggregateType || e.aggregateType === aggregateType),
    )
  }

  async getEventsByType(type: EventType, limit = 100): Promise<DomainEvent[]> {
    return this.events.filter((e) => e.type === type).slice(-limit)
  }

  async getAllEvents(since?: string, limit = 1000): Promise<DomainEvent[]> {
    let filtered = this.events
    if (since) {
      filtered = filtered.filter((e) => e.occurredAt > since)
    }
    return filtered.slice(-limit)
  }

  subscribe(type: EventType | "*", handler: (event: DomainEvent) => void): () => void {
    const handlers = this.subscribers.get(type) || []
    handlers.push(handler)
    this.subscribers.set(type, handlers)

    return () => {
      const current = this.subscribers.get(type) || []
      this.subscribers.set(
        type,
        current.filter((h) => h !== handler),
      )
    }
  }

  private async publish(event: DomainEvent): Promise<void> {
    const typeHandlers = this.subscribers.get(event.type) || []
    const allHandlers = this.subscribers.get("*") || []

    for (const handler of [...typeHandlers, ...allHandlers]) {
      try {
        handler(event)
      } catch (error) {
        console.error(`[EventStore] Handler error for ${event.type}:`, error)
      }
    }
  }

  // Replay events to rebuild state
  async replay(aggregateId: string, aggregateType: string, handler: (event: DomainEvent) => void): Promise<void> {
    const events = await this.getEvents(aggregateId, aggregateType)
    for (const event of events) {
      handler(event)
    }
  }
}

export const eventStore = new EventStore()

// Helper to create events with proper metadata
export function createEvent<T>(
  type: EventType,
  aggregateId: string,
  aggregateType: DomainEvent["aggregateType"],
  payload: T,
  metadata: Partial<EventMetadata> & { userId: string; userRole: string },
): Omit<DomainEvent<T>, "id" | "occurredAt"> {
  return {
    type,
    aggregateId,
    aggregateType,
    version: 1,
    payload,
    metadata: {
      ...metadata,
      requestId: metadata.requestId || crypto.randomUUID(),
      source: metadata.source || "web",
    },
    correlationId: metadata.requestId || crypto.randomUUID(),
  }
}
