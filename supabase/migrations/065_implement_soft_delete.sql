-- Migration: Implement Soft Delete System
-- Description: Rename existing status columns to tablename_status format and add status boolean column for soft delete
-- Created: 2025-01-XX
-- 
-- Strategy:
-- 1. Rename existing status columns to tablename_status (to avoid conflicts)
-- 2. Add status boolean column to all tables (default: true = not deleted, false = deleted)
-- 3. Update indexes
-- 4. Update RLS policies to filter by status = true

-- ============================================
-- STEP 1: RENAME EXISTING STATUS COLUMNS
-- ============================================
-- Rename status columns that are used for business logic to tablename_status format

-- Bookings table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'status'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN status TO booking_status;
    RAISE NOTICE 'Renamed bookings.status to booking_status';
  END IF;
END $$;

-- Invoices table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'status'
  ) THEN
    ALTER TABLE invoices RENAME COLUMN status TO invoice_status;
    RAISE NOTICE 'Renamed invoices.status to invoice_status';
  END IF;
END $$;

-- Tasks table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'status'
  ) THEN
    ALTER TABLE tasks RENAME COLUMN status TO task_status;
    RAISE NOTICE 'Renamed tasks.status to task_status';
  END IF;
END $$;

-- Incidents table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'incidents' AND column_name = 'status'
  ) THEN
    ALTER TABLE incidents RENAME COLUMN status TO incident_status;
    RAISE NOTICE 'Renamed incidents.status to incident_status';
  END IF;
END $$;

-- Claims table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'status'
  ) THEN
    ALTER TABLE claims RENAME COLUMN status TO claim_status;
    RAISE NOTICE 'Renamed claims.status to claim_status';
  END IF;
END $$;

-- Payments table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'status'
  ) THEN
    ALTER TABLE payments RENAME COLUMN status TO payment_status;
    RAISE NOTICE 'Renamed payments.status to payment_status';
  END IF;
END $$;

-- Payment transactions table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_transactions' AND column_name = 'status'
  ) THEN
    ALTER TABLE payment_transactions RENAME COLUMN status TO payment_transaction_status;
    RAISE NOTICE 'Renamed payment_transactions.status to payment_transaction_status';
  END IF;
END $$;

-- Refunds table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'refunds' AND column_name = 'status'
  ) THEN
    ALTER TABLE refunds RENAME COLUMN status TO refund_status;
    RAISE NOTICE 'Renamed refunds.status to refund_status';
  END IF;
END $$;

-- Service orders table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_orders' AND column_name = 'status'
  ) THEN
    ALTER TABLE service_orders RENAME COLUMN status TO service_order_status;
    RAISE NOTICE 'Renamed service_orders.status to service_order_status';
  END IF;
END $$;

-- Service order items table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'service_order_items' AND column_name = 'status'
  ) THEN
    ALTER TABLE service_order_items RENAME COLUMN status TO service_order_item_status;
    RAISE NOTICE 'Renamed service_order_items.status to service_order_item_status';
  END IF;
END $$;

-- Inventory items table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_items' AND column_name = 'status'
  ) THEN
    ALTER TABLE inventory_items RENAME COLUMN status TO inventory_item_status;
    RAISE NOTICE 'Renamed inventory_items.status to inventory_item_status';
  END IF;
END $$;

-- Access logs table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'access_logs' AND column_name = 'status'
  ) THEN
    ALTER TABLE access_logs RENAME COLUMN status TO access_log_status;
    RAISE NOTICE 'Renamed access_logs.status to access_log_status';
  END IF;
END $$;

-- Email queue table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_queue' AND column_name = 'status'
  ) THEN
    ALTER TABLE email_queue RENAME COLUMN status TO email_queue_status;
    RAISE NOTICE 'Renamed email_queue.status to email_queue_status';
  END IF;
END $$;

-- Notification events table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_events' AND column_name = 'status'
  ) THEN
    ALTER TABLE notification_events RENAME COLUMN status TO notification_event_status;
    RAISE NOTICE 'Renamed notification_events.status to notification_event_status';
  END IF;
END $$;

-- Booking proposals table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'booking_proposals' AND column_name = 'status'
  ) THEN
    ALTER TABLE booking_proposals RENAME COLUMN status TO booking_proposal_status;
    RAISE NOTICE 'Renamed booking_proposals.status to booking_proposal_status';
  END IF;
END $$;

-- Company members table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_members' AND column_name = 'status'
  ) THEN
    ALTER TABLE company_members RENAME COLUMN status TO company_member_status;
    RAISE NOTICE 'Renamed company_members.status to company_member_status';
  END IF;
END $$;

-- ============================================
-- STEP 2: UPDATE INDEXES FOR RENAMED COLUMNS
-- ============================================

-- Drop old indexes and create new ones with renamed column names
DROP INDEX IF EXISTS idx_bookings_status;
CREATE INDEX IF NOT EXISTS idx_bookings_booking_status ON bookings(booking_status);

DROP INDEX IF EXISTS idx_invoices_status;
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_status ON invoices(invoice_status);

DROP INDEX IF EXISTS idx_tasks_status;
CREATE INDEX IF NOT EXISTS idx_tasks_task_status ON tasks(task_status);

DROP INDEX IF EXISTS idx_incidents_status;
CREATE INDEX IF NOT EXISTS idx_incidents_incident_status ON incidents(incident_status);

DROP INDEX IF EXISTS idx_claims_status;
CREATE INDEX IF NOT EXISTS idx_claims_claim_status ON claims(claim_status);

DROP INDEX IF EXISTS idx_payments_status;
CREATE INDEX IF NOT EXISTS idx_payments_payment_status ON payments(payment_status);

DROP INDEX IF EXISTS idx_payment_transactions_status;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_transaction_status ON payment_transactions(payment_transaction_status);

DROP INDEX IF EXISTS idx_refunds_status;
CREATE INDEX IF NOT EXISTS idx_refunds_refund_status ON refunds(refund_status);

DROP INDEX IF EXISTS idx_service_orders_status;
CREATE INDEX IF NOT EXISTS idx_service_orders_service_order_status ON service_orders(service_order_status);

DROP INDEX IF EXISTS idx_service_order_items_status;
CREATE INDEX IF NOT EXISTS idx_service_order_items_service_order_item_status ON service_order_items(service_order_item_status);

DROP INDEX IF EXISTS idx_inventory_items_status;
CREATE INDEX IF NOT EXISTS idx_inventory_items_inventory_item_status ON inventory_items(inventory_item_status);

DROP INDEX IF EXISTS idx_access_logs_status;
CREATE INDEX IF NOT EXISTS idx_access_logs_access_log_status ON access_logs(access_log_status);

DROP INDEX IF EXISTS idx_email_queue_status;
CREATE INDEX IF NOT EXISTS idx_email_queue_email_queue_status ON email_queue(email_queue_status);

DROP INDEX IF EXISTS idx_notification_events_status;
CREATE INDEX IF NOT EXISTS idx_notification_events_notification_event_status ON notification_events(notification_event_status);

DROP INDEX IF EXISTS idx_booking_proposals_status;
CREATE INDEX IF NOT EXISTS idx_booking_proposals_booking_proposal_status ON booking_proposals(booking_proposal_status);

DROP INDEX IF EXISTS idx_company_members_status;
CREATE INDEX IF NOT EXISTS idx_company_members_company_member_status ON company_members(company_member_status);

-- Update composite indexes that include status
DROP INDEX IF EXISTS idx_access_logs_type_warehouse_status;
CREATE INDEX IF NOT EXISTS idx_access_logs_type_warehouse_access_log_status ON access_logs(visitor_type, warehouse_id, access_log_status, entry_time DESC);

DROP INDEX IF EXISTS idx_email_queue_pending;
CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON email_queue(email_queue_status, priority DESC, created_at) WHERE email_queue_status = 'pending';

DROP INDEX IF EXISTS idx_email_queue_failed;
CREATE INDEX IF NOT EXISTS idx_email_queue_failed ON email_queue(email_queue_status, retry_count, created_at) WHERE email_queue_status = 'failed' AND retry_count < max_retries;

DROP INDEX IF EXISTS idx_notification_events_pending;
CREATE INDEX IF NOT EXISTS idx_notification_events_pending ON notification_events(notification_event_status) WHERE notification_event_status = 'pending';

-- ============================================
-- STEP 3: ADD STATUS BOOLEAN COLUMN TO ALL TABLES
-- ============================================
-- Add status boolean column for soft delete (true = not deleted, false = deleted)

-- Profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Warehouses table
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Warehouse floors table
ALTER TABLE warehouse_floors ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Warehouse halls table
ALTER TABLE warehouse_halls ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Warehouse zones table
ALTER TABLE warehouse_zones ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Incidents table
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Claims table
ALTER TABLE claims ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Worker shifts table
ALTER TABLE worker_shifts ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Payment transactions table
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Refunds table
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Inventory items table
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Inventory movements table
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Warehouse services table
ALTER TABLE warehouse_services ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Service orders table
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Service order items table
ALTER TABLE service_order_items ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Access logs table
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Email queue table
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Notification events table
ALTER TABLE notification_events ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Warehouse pricing table
ALTER TABLE warehouse_pricing ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Booking proposals table
ALTER TABLE booking_proposals ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Company members table
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Company invitations table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_invitations') THEN
    ALTER TABLE company_invitations ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;
  END IF;
END $$;

-- Audit logs table
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Notification preferences table
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Warehouse staff table
ALTER TABLE warehouse_staff ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Booking modifications table
ALTER TABLE booking_modifications ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Booking usage periods table
ALTER TABLE booking_usage_periods ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Customer stock levels table
ALTER TABLE customer_stock_levels ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Warehouse regions table
ALTER TABLE warehouse_regions ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Warehouse capacity snapshots table
ALTER TABLE warehouse_capacity_snapshots ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Brokers table
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Customer groups table
ALTER TABLE customer_groups ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Performance targets table
ALTER TABLE performance_targets ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Broker customers table
ALTER TABLE broker_customers ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- Customer group members table
ALTER TABLE customer_group_members ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true NOT NULL;

-- ============================================
-- STEP 4: CREATE INDEXES FOR STATUS COLUMN (SOFT DELETE)
-- ============================================
-- Create indexes for soft delete filtering (only for deleted records)

CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_warehouses_status ON warehouses(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_warehouse_floors_status ON warehouse_floors(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_warehouse_halls_status ON warehouse_halls(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_warehouse_zones_status ON warehouse_zones(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_bookings_status_soft_delete ON bookings(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_invoices_status_soft_delete ON invoices(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_tasks_status_soft_delete ON tasks(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_incidents_status_soft_delete ON incidents(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_claims_status_soft_delete ON claims(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_worker_shifts_status ON worker_shifts(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_payments_status_soft_delete ON payments(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_soft_delete ON payment_transactions(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_refunds_status_soft_delete ON refunds(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_inventory_items_status_soft_delete ON inventory_items(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_inventory_movements_status ON inventory_movements(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_warehouse_services_status ON warehouse_services(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_service_orders_status_soft_delete ON service_orders(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_service_order_items_status_soft_delete ON service_order_items(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_access_logs_status_soft_delete ON access_logs(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_email_queue_status_soft_delete ON email_queue(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_notification_events_status_soft_delete ON notification_events(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_warehouse_pricing_status ON warehouse_pricing(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_booking_proposals_status_soft_delete ON booking_proposals(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_company_members_status_soft_delete ON company_members(status) WHERE status = false;
-- Company invitations index (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_invitations') THEN
    CREATE INDEX IF NOT EXISTS idx_company_invitations_status ON company_invitations(status) WHERE status = false;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_notification_preferences_status ON notification_preferences(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_warehouse_staff_status ON warehouse_staff(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_booking_modifications_status ON booking_modifications(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_booking_usage_periods_status ON booking_usage_periods(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_customer_stock_levels_status ON customer_stock_levels(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_warehouse_regions_status ON warehouse_regions(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_warehouse_capacity_snapshots_status ON warehouse_capacity_snapshots(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_brokers_status ON brokers(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_customer_groups_status ON customer_groups(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_performance_targets_status ON performance_targets(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_broker_customers_status ON broker_customers(status) WHERE status = false;
CREATE INDEX IF NOT EXISTS idx_customer_group_members_status ON customer_group_members(status) WHERE status = false;

-- ============================================
-- STEP 5: UPDATE RLS POLICIES
-- ============================================
-- Update all RLS policies to filter by status = true (only show non-deleted records)
-- Note: This is a comprehensive update. We'll update the main policies here.

-- Helper function to check if a table has RLS enabled
CREATE OR REPLACE FUNCTION table_has_rls(table_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
      AND t.tablename = table_name
      AND c.relrowsecurity = true
  );
END;
$$ LANGUAGE plpgsql;

-- Note: RLS policy updates will be done in a separate step to avoid conflicts
-- For now, we'll create a comment indicating that policies need to be updated
COMMENT ON COLUMN profiles.status IS 'Soft delete flag: true = not deleted, false = deleted';
COMMENT ON COLUMN companies.status IS 'Soft delete flag: true = not deleted, false = deleted';
COMMENT ON COLUMN warehouses.status IS 'Soft delete flag: true = not deleted, false = deleted';
COMMENT ON COLUMN bookings.status IS 'Soft delete flag: true = not deleted, false = deleted';
COMMENT ON COLUMN invoices.status IS 'Soft delete flag: true = not deleted, false = deleted';
COMMENT ON COLUMN tasks.status IS 'Soft delete flag: true = not deleted, false = deleted';
COMMENT ON COLUMN incidents.status IS 'Soft delete flag: true = not deleted, false = deleted';
COMMENT ON COLUMN claims.status IS 'Soft delete flag: true = not deleted, false = deleted';
COMMENT ON COLUMN payments.status IS 'Soft delete flag: true = not deleted, false = deleted';
COMMENT ON COLUMN service_orders.status IS 'Soft delete flag: true = not deleted, false = deleted';

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
DECLARE
  renamed_count INTEGER := 0;
  status_added_count INTEGER := 0;
BEGIN
  -- Count renamed columns
  SELECT COUNT(*) INTO renamed_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name IN (
      'booking_status', 'invoice_status', 'task_status', 'incident_status', 'claim_status',
      'payment_status', 'payment_transaction_status', 'refund_status',
      'service_order_status', 'service_order_item_status', 'inventory_item_status',
      'access_log_status', 'email_queue_status', 'notification_event_status',
      'booking_proposal_status', 'company_member_status'
    );
  
  -- Count status columns added
  SELECT COUNT(*) INTO status_added_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'status'
    AND data_type = 'boolean';
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Status columns renamed: %', renamed_count;
  RAISE NOTICE '  Status (soft delete) columns added: %', status_added_count;
  
  IF renamed_count < 16 THEN
    RAISE WARNING 'Expected 16 renamed status columns, found %', renamed_count;
  END IF;
  
  IF status_added_count < 40 THEN
    RAISE WARNING 'Expected at least 40 status columns, found %', status_added_count;
  END IF;
END $$;

