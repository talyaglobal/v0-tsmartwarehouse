/**
 * Event Emitter
 * Type-safe event system for warehouse marketplace
 */

import type {
  EventType,
  EventPayload,
  EventHandler,
  EventSubscription,
  EventEmitterOptions,
} from './types'

/**
 * Event Emitter class
 * Manages event subscriptions and emissions
 */
export class EventEmitter {
  private subscriptions: Map<EventType, EventSubscription[]> = new Map()
  private options: Required<EventEmitterOptions>
  private subscriptionCounter = 0

  constructor(options: EventEmitterOptions = {}) {
    this.options = {
      maxListeners: options.maxListeners ?? 50,
      enableLogging: options.enableLogging ?? process.env.NODE_ENV === 'development',
    }
  }

  /**
   * Subscribe to an event type
   */
  on<T extends EventPayload>(
    eventType: T['eventType'],
    handler: EventHandler<T>,
    priority: number = 0
  ): string {
    const subscriptionId = `sub_${++this.subscriptionCounter}_${Date.now()}`

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, [])
    }

    const subscriptions = this.subscriptions.get(eventType)!
    
    // Check max listeners
    if (subscriptions.length >= this.options.maxListeners) {
      throw new Error(
        `Maximum listeners (${this.options.maxListeners}) exceeded for event type: ${eventType}`
      )
    }

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler,
      priority,
    }

    subscriptions.push(subscription)
    
    // Sort by priority (higher priority first)
    subscriptions.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

    if (this.options.enableLogging) {
    }

    return subscriptionId
  }

  /**
   * Subscribe to an event type (one-time)
   */
  once<T extends EventPayload>(
    eventType: T['eventType'],
    handler: EventHandler<T>,
    priority: number = 0
  ): string {
    const subscriptionId = this.on(
      eventType,
      async (payload) => {
        await handler(payload as T)
        this.off(eventType, subscriptionId)
      },
      priority
    )
    return subscriptionId
  }

  /**
   * Unsubscribe from an event
   */
  off(eventType: EventType, subscriptionId: string): boolean {
    const subscriptions = this.subscriptions.get(eventType)
    if (!subscriptions) {
      return false
    }

    const index = subscriptions.findIndex((sub) => sub.id === subscriptionId)
    if (index === -1) {
      return false
    }

    subscriptions.splice(index, 1)

    if (this.options.enableLogging) {
    }

    return true
  }

  /**
   * Remove all subscriptions for an event type
   */
  removeAllListeners(eventType?: EventType): void {
    if (eventType) {
      this.subscriptions.delete(eventType)
      if (this.options.enableLogging) {
      }
    } else {
      this.subscriptions.clear()
      if (this.options.enableLogging) {
      }
    }
  }

  /**
   * Emit an event
   */
  async emit<T extends EventPayload>(payload: T): Promise<void> {
    const eventType = payload.eventType
    const subscriptions = this.subscriptions.get(eventType) || []

    if (this.options.enableLogging) {
    }

    // Execute handlers in priority order
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await subscription.handler(payload)
        } catch (error) {
          console.error(
            `[EventEmitter] Error in handler for ${eventType} (${subscription.id}):`,
            error
          )
          throw error
        }
      })
    )

    // Log failures
    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      console.error(
        `[EventEmitter] ${failures.length} handler(s) failed for ${eventType}`,
        failures.map((f) => (f.status === 'rejected' ? f.reason : null))
      )
    }
  }

  /**
   * Get listener count for an event type
   */
  listenerCount(eventType: EventType): number {
    return this.subscriptions.get(eventType)?.length || 0
  }

  /**
   * Get all event types with listeners
   */
  eventNames(): EventType[] {
    return Array.from(this.subscriptions.keys())
  }
}

/**
 * Global event emitter instance
 */
let globalEventEmitter: EventEmitter | null = null

/**
 * Get or create the global event emitter instance
 */
export function getEventEmitter(options?: EventEmitterOptions): EventEmitter {
  if (!globalEventEmitter) {
    globalEventEmitter = new EventEmitter(options)
  }
  return globalEventEmitter
}

/**
 * Reset the global event emitter (useful for testing)
 */
export function resetEventEmitter(): void {
  globalEventEmitter = null
}

