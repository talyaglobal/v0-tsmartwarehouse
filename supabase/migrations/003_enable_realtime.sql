-- Enable Realtime for tables that need real-time updates
-- This migration enables Supabase Realtime subscriptions for:
-- - tasks (for live task status updates)
-- - notifications (for real-time notifications)
-- - warehouse_halls (for live warehouse utilization)
-- - bookings (for warehouse utilization calculations)

-- Enable Realtime on tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- Enable Realtime on notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable Realtime on warehouse_halls table
ALTER PUBLICATION supabase_realtime ADD TABLE warehouse_halls;

-- Enable Realtime on bookings table (affects warehouse utilization)
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- Note: If the publication doesn't exist, you may need to create it first:
-- CREATE PUBLICATION supabase_realtime FOR TABLE tasks, notifications, warehouse_halls, bookings;

