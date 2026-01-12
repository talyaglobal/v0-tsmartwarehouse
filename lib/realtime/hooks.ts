"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import type { Task, Notification } from "@/types"

type RealtimeChannelStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR"

/**
 * Generic hook for real-time subscriptions
 */
export function useRealtimeSubscription<T>(
  table: string,
  filter?: string,
  callback?: (payload: any) => void
) {
  const [data, setData] = useState<T[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    const setupSubscription = async () => {
      try {
        // Initial fetch
        const { data: initialData, error: fetchError } = await supabase
          .from(table)
          .select("*")
          .order("created_at", { ascending: false })

        if (fetchError) throw fetchError

        setData(initialData || [])

        // Set up real-time subscription
        channel = supabase
          .channel(`${table}_changes`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: table,
              filter: filter,
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              if (callback) {
                callback(payload)
              }

              // Update local state
              if (payload.eventType === "INSERT") {
                setData((prev) => [payload.new as T, ...prev])
              } else if (payload.eventType === "UPDATE") {
                setData((prev) =>
                  prev.map((item: any) =>
                    item.id === payload.new.id ? (payload.new as T) : item
                  )
                )
              } else if (payload.eventType === "DELETE") {
                setData((prev) =>
                  prev.filter((item: any) => item.id !== payload.old.id)
                )
              }
            }
          )
          .subscribe((status: RealtimeChannelStatus) => {
            setIsConnected(status === "SUBSCRIBED")
            if (status === "SUBSCRIBED") {
              setError(null)
            }
          })

        setIsConnected(true)
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"))
        setIsConnected(false)
      }
    }

    setupSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [table, filter, callback])

  return { data, isConnected, error }
}

/**
 * Hook for real-time task updates
 */
export function useRealtimeTasks(userId?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    const setupSubscription = async () => {
      try {
        // Build query
        let query = supabase.from("tasks").select("*").order("created_at", { ascending: false })

        // Filter by user if provided
        if (userId) {
          query = query.eq("assigned_to", userId)
        }

        const { data: initialData, error: fetchError } = await query

        if (fetchError) throw fetchError

        setTasks(initialData || [])

        // Set up real-time subscription
        const filter = userId ? `assigned_to=eq.${userId}` : undefined

        channel = supabase
          .channel("tasks_changes")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "tasks",
              filter: filter,
            },
            (payload: RealtimePostgresChangesPayload<Task>) => {
              if (payload.eventType === "INSERT") {
                setTasks((prev) => [payload.new as Task, ...prev])
              } else if (payload.eventType === "UPDATE") {
                setTasks((prev) =>
                  prev.map((task) =>
                    task.id === payload.new.id ? (payload.new as Task) : task
                  )
                )
              } else if (payload.eventType === "DELETE") {
                setTasks((prev) =>
                  prev.filter((task) => task.id !== payload.old.id)
                )
              }
            }
          )
          .subscribe((status: RealtimeChannelStatus) => {
            setIsConnected(status === "SUBSCRIBED")
            if (status === "SUBSCRIBED") {
              setError(null)
            }
          })

        setIsConnected(true)
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"))
        setIsConnected(false)
      }
    }

    setupSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [userId])

  return { tasks, isConnected, error }
}

/**
 * Hook for real-time notifications
 */
export function useRealtimeNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    const setupSubscription = async () => {
      try {
        // Initial fetch
        const { data: initialData, error: fetchError } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50)

        if (fetchError) throw fetchError

        const notificationsData = (initialData || []).map((n: any) => ({
          id: n.id,
          userId: n.user_id,
          type: n.type,
          channel: n.channel,
          title: n.title,
          message: n.message,
          read: n.read || false,
          createdAt: n.created_at || new Date().toISOString(),
        })) as Notification[]
        
        setNotifications(notificationsData)
        setUnreadCount(notificationsData.filter((n: Notification) => !n.read).length)

        // Set up real-time subscription
        channel = supabase
          .channel("notifications_changes")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            (payload: RealtimePostgresChangesPayload<any>) => {
              if (payload.eventType === "INSERT") {
                const rawNotification = payload.new
                const newNotification: Notification = {
                  id: rawNotification.id,
                  userId: rawNotification.user_id,
                  type: rawNotification.type,
                  channel: rawNotification.channel,
                  title: rawNotification.title,
                  message: rawNotification.message,
                  read: rawNotification.read || false,
                  createdAt: rawNotification.created_at || new Date().toISOString(),
                }
                setNotifications((prev) => [newNotification, ...prev])
                setUnreadCount((prev) => prev + 1)
              } else if (payload.eventType === "UPDATE") {
                const rawNotification = payload.new
                const updatedNotification: Notification = {
                  id: rawNotification.id,
                  userId: rawNotification.user_id,
                  type: rawNotification.type,
                  channel: rawNotification.channel,
                  title: rawNotification.title,
                  message: rawNotification.message,
                  read: rawNotification.read || false,
                  createdAt: rawNotification.created_at || new Date().toISOString(),
                }
                setNotifications((prev) =>
                  prev.map((n) =>
                    n.id === updatedNotification.id ? updatedNotification : n
                  )
                )
                // Recalculate unread count
                setNotifications((prev) => {
                  const unread = prev.filter((n) => !n.read).length
                  setUnreadCount(unread)
                  return prev
                })
              } else if (payload.eventType === "DELETE") {
                setNotifications((prev) =>
                  prev.filter((n) => n.id !== payload.old.id)
                )
                setUnreadCount((prev) => Math.max(0, prev - 1))
              }
            }
          )
          .subscribe((status: RealtimeChannelStatus) => {
            setIsConnected(status === "SUBSCRIBED")
            if (status === "SUBSCRIBED") {
              setError(null)
            }
          })

        setIsConnected(true)
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"))
        setIsConnected(false)
      }
    }

    setupSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [userId])

  const markAsRead = useCallback(
    async (notificationId: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)

      if (error) {
        setError(error)
      }
    },
    []
  )

  const markAllAsRead = useCallback(async () => {
    const supabase = createClient()
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false)

    if (error) {
      setError(error)
    }
  }, [userId])

  return {
    notifications,
    unreadCount,
    isConnected,
    error,
    markAsRead,
    markAllAsRead,
  }
}

/**
 * Hook for real-time warehouse utilization
 */
export function useRealtimeWarehouseUtilization(warehouseId?: string) {
  const [utilization, setUtilization] = useState({
    totalSqFt: 0,
    occupiedSqFt: 0,
    availableSqFt: 0,
    utilizationPercent: 0,
    floors: [] as Array<{
      floorNumber: number
      totalSqFt: number
      occupiedSqFt: number
      availableSqFt: number
      utilizationPercent: number
      halls: Array<{
        hallName: string
        totalSqFt: number
        occupiedSqFt: number
        availableSqFt: number
        utilizationPercent: number
      }>
    }>,
  })
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channels: RealtimeChannel[] = []

    const calculateUtilization = async () => {
      try {
        // Get warehouse data
        let warehouseQuery = supabase.from("warehouses").select("*")
        if (warehouseId) {
          warehouseQuery = warehouseQuery.eq("id", warehouseId)
        }

        const { data: warehouses, error: warehouseError } = await warehouseQuery

        if (warehouseError) throw warehouseError

        if (!warehouses || warehouses.length === 0) {
          return
        }

        const warehouse = warehouses[0]

        // Get floors
        const { data: floors, error: floorsError } = await supabase
          .from("warehouse_floors")
          .select("*")
          .eq("warehouse_id", warehouse.id)
          .order("floor_number", { ascending: true })

        if (floorsError) throw floorsError

        // Get halls and calculate utilization
        const floorsData = await Promise.all(
          (floors || []).map(async (floor: any) => {
            const { data: halls, error: hallsError } = await supabase
              .from("warehouse_halls")
              .select("*")
              .eq("floor_id", floor.id)
              .order("hall_name", { ascending: true })

            if (hallsError) throw hallsError

            const hallsData = (halls || []).map((hall: any) => ({
              hallName: hall.hall_name,
              totalSqFt: hall.sq_ft,
              occupiedSqFt: hall.occupied_sq_ft || 0,
              availableSqFt: hall.available_sq_ft || 0,
              utilizationPercent:
                hall.sq_ft > 0
                  ? Math.round(((hall.occupied_sq_ft || 0) / hall.sq_ft) * 100)
                  : 0,
            }))

            const floorOccupied = hallsData.reduce(
              (sum: number, hall: any) => sum + hall.occupiedSqFt,
              0
            )
            const floorTotal = hallsData.reduce(
              (sum: number, hall: any) => sum + hall.totalSqFt,
              0
            )

            return {
              floorNumber: floor.floor_number,
              totalSqFt: floorTotal,
              occupiedSqFt: floorOccupied,
              availableSqFt: floorTotal - floorOccupied,
              utilizationPercent:
                floorTotal > 0 ? Math.round((floorOccupied / floorTotal) * 100) : 0,
              halls: hallsData,
            }
          })
        )

        const totalOccupied = floorsData.reduce(
          (sum: number, floor: any) => sum + floor.occupiedSqFt,
          0
        )
        const totalSqFt = floorsData.reduce(
          (sum: number, floor: any) => sum + floor.totalSqFt,
          0
        )

        setUtilization({
          totalSqFt,
          occupiedSqFt: totalOccupied,
          availableSqFt: totalSqFt - totalOccupied,
          utilizationPercent:
            totalSqFt > 0 ? Math.round((totalOccupied / totalSqFt) * 100) : 0,
          floors: floorsData,
        })

        // Subscribe to warehouse_halls changes for real-time updates
        const hallsChannel = supabase
          .channel("warehouse_halls_changes")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "warehouse_halls",
            },
            () => {
              // Recalculate when halls change
              calculateUtilization()
            }
          )
          .subscribe()

        channels.push(hallsChannel)

        // Subscribe to bookings changes (affects utilization)
        const bookingsChannel = supabase
          .channel("bookings_changes")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
            },
            () => {
              // Recalculate when bookings change
              calculateUtilization()
            }
          )
          .subscribe()

        channels.push(bookingsChannel)

        setIsConnected(true)
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"))
        setIsConnected(false)
      }
    }

    calculateUtilization()

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel)
      })
    }
  }, [warehouseId])

  return { utilization, isConnected, error }
}

/**
 * Hook for real-time connection status indicator
 */
export function useRealtimeConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("connection_status")
      .subscribe((status: RealtimeChannelStatus) => {
        setIsConnected(status === "SUBSCRIBED")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return isConnected
}

