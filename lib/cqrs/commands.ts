// CQRS - Command Handlers
// Separates write operations from read operations

import { eventStore, createEvent } from "@/lib/events/event-store"

export interface Command<T = unknown> {
  type: string
  payload: T
  metadata: {
    userId: string
    userRole: string
    requestId: string
    timestamp: string
  }
}

export interface CommandResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  eventId?: string
}

type CommandHandler<T, R> = (command: Command<T>) => Promise<CommandResult<R>>

class CommandBus {
  private handlers: Map<string, CommandHandler<unknown, unknown>> = new Map()

  register<T, R>(commandType: string, handler: CommandHandler<T, R>): void {
    this.handlers.set(commandType, handler as CommandHandler<unknown, unknown>)
  }

  async dispatch<T, R>(command: Command<T>): Promise<CommandResult<R>> {
    const handler = this.handlers.get(command.type)
    if (!handler) {
      return { success: false, error: `No handler for command: ${command.type}` }
    }

    try {
      return (await handler(command)) as CommandResult<R>
    } catch (error) {
      console.error(`[CommandBus] Error executing ${command.type}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}

export const commandBus = new CommandBus()

// Register command handlers
commandBus.register("CreateBooking", async (command) => {
  const { payload, metadata } = command

  const event = createEvent("booking.created", crypto.randomUUID(), "booking", payload, {
    userId: metadata.userId,
    userRole: metadata.userRole,
    requestId: metadata.requestId,
  })

  const stored = await eventStore.append(event)
  return { success: true, data: payload, eventId: stored.id }
})

commandBus.register("ConfirmBooking", async (command) => {
  const { payload, metadata } = command as Command<{ bookingId: string }>

  const event = createEvent("booking.confirmed", payload.bookingId, "booking", payload, {
    userId: metadata.userId,
    userRole: metadata.userRole,
    requestId: metadata.requestId,
  })

  const stored = await eventStore.append(event)
  return { success: true, data: payload, eventId: stored.id }
})

commandBus.register("ProcessPayment", async (command) => {
  const { payload, metadata } = command

  const event = createEvent("payment.received", crypto.randomUUID(), "payment", payload, {
    userId: metadata.userId,
    userRole: metadata.userRole,
    requestId: metadata.requestId,
  })

  const stored = await eventStore.append(event)
  return { success: true, data: payload, eventId: stored.id }
})

commandBus.register("ReportIncident", async (command) => {
  const { payload, metadata } = command

  const event = createEvent("incident.reported", crypto.randomUUID(), "incident", payload, {
    userId: metadata.userId,
    userRole: metadata.userRole,
    requestId: metadata.requestId,
  })

  const stored = await eventStore.append(event)
  return { success: true, data: payload, eventId: stored.id }
})

commandBus.register("AssignTask", async (command) => {
  const { payload, metadata } = command as Command<{ taskId: string; workerId: string }>

  const event = createEvent("task.assigned", payload.taskId, "task", payload, {
    userId: metadata.userId,
    userRole: metadata.userRole,
    requestId: metadata.requestId,
  })

  const stored = await eventStore.append(event)
  return { success: true, data: payload, eventId: stored.id }
})

// Helper to create commands
export function createCommand<T>(type: string, payload: T, userId: string, userRole: string): Command<T> {
  return {
    type,
    payload,
    metadata: {
      userId,
      userRole,
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  }
}
