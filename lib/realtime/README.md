# Real-time Features

This directory contains the real-time functionality for the TSmart Warehouse Management System using Supabase Realtime.

## Overview

The real-time features enable live updates across the application without requiring page refreshes. This includes:

- **Live task status updates** - Workers see task changes in real-time
- **Real-time notifications** - Users receive notifications instantly
- **Live warehouse utilization** - Admin dashboard shows current warehouse capacity

## Setup

### 1. Enable Supabase Realtime

1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Replication**
3. Enable Realtime for the following tables:
   - `tasks`
   - `notifications`
   - `warehouse_halls`
   - `bookings`

Alternatively, run the migration:

```bash
# Apply the migration to enable Realtime
supabase migration up
```

The migration file `supabase/migrations/003_enable_realtime.sql` will enable Realtime on the required tables.

### 2. Environment Variables

Ensure your `.env.local` file has the Supabase configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage

### Real-time Tasks

```tsx
import { useRealtimeTasks } from "@/lib/realtime"
import { useUser } from "@/lib/hooks/use-user"

function TasksPage() {
  const { user } = useUser()
  const { tasks, isConnected, error } = useRealtimeTasks(user?.id)

  return (
    <div>
      {isConnected && <span>Live updates enabled</span>}
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  )
}
```

### Real-time Notifications

```tsx
import { useRealtimeNotifications } from "@/lib/realtime"
import { useUser } from "@/lib/hooks/use-user"

function NotificationsPage() {
  const { user } = useUser()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useRealtimeNotifications(user?.id || "")

  return (
    <div>
      <h2>Notifications ({unreadCount} unread)</h2>
      {notifications.map(notification => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  )
}
```

### Real-time Warehouse Utilization

```tsx
import { useRealtimeWarehouseUtilization } from "@/lib/realtime"

function AdminDashboard() {
  const { utilization, isConnected } = useRealtimeWarehouseUtilization()

  return (
    <div>
      <h2>Warehouse Utilization: {utilization.utilizationPercent}%</h2>
      {utilization.floors.map(floor => (
        <FloorCard key={floor.floorNumber} floor={floor} />
      ))}
    </div>
  )
}
```

### Connection Status Indicator

```tsx
import { RealtimeIndicator } from "@/components/ui/realtime-indicator"

function Header() {
  return (
    <div>
      <RealtimeIndicator showLabel size="sm" />
    </div>
  )
}
```

## Hooks Reference

### `useRealtimeTasks(userId?: string)`

Returns real-time task updates for a specific user or all tasks.

**Returns:**
- `tasks: Task[]` - Array of tasks
- `isConnected: boolean` - Connection status
- `error: Error | null` - Error if connection fails

### `useRealtimeNotifications(userId: string)`

Returns real-time notifications for a user.

**Returns:**
- `notifications: Notification[]` - Array of notifications
- `unreadCount: number` - Count of unread notifications
- `isConnected: boolean` - Connection status
- `error: Error | null` - Error if connection fails
- `markAsRead(id: string)` - Mark a notification as read
- `markAllAsRead()` - Mark all notifications as read

### `useRealtimeWarehouseUtilization(warehouseId?: string)`

Returns real-time warehouse utilization data.

**Returns:**
- `utilization: UtilizationData` - Warehouse utilization data
- `isConnected: boolean` - Connection status
- `error: Error | null` - Error if connection fails

### `useRealtimeConnectionStatus()`

Returns the overall real-time connection status.

**Returns:**
- `isConnected: boolean` - Connection status

## How It Works

1. **Supabase Realtime** uses PostgreSQL's logical replication to stream database changes
2. **React Hooks** subscribe to these changes and update component state
3. **Automatic Reconnection** - Supabase client handles reconnection automatically
4. **Optimistic Updates** - UI updates immediately when changes occur

## Performance Considerations

- Real-time subscriptions are automatically cleaned up when components unmount
- Only subscribe to data you need (use filters when possible)
- Consider pagination for large datasets
- Monitor connection status to provide user feedback

## Troubleshooting

### Not Receiving Updates

1. Check that Realtime is enabled in Supabase dashboard
2. Verify environment variables are set correctly
3. Check browser console for connection errors
4. Ensure Row Level Security (RLS) policies allow access

### Connection Drops

- Supabase client automatically reconnects
- Check network connectivity
- Verify Supabase project is active

### High Memory Usage

- Ensure subscriptions are properly cleaned up
- Use filters to limit data scope
- Consider pagination for large lists

## Future Enhancements

- [ ] Add WebSocket fallback for better reliability
- [ ] Implement message queuing for offline scenarios
- [ ] Add connection retry logic with exponential backoff
- [ ] Create admin dashboard for monitoring real-time connections
- [ ] Add metrics for real-time performance

