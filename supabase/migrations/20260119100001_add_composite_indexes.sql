-- Migration: Add Composite and Partial Indexes
-- Description: Optimize frequently queried column combinations
-- Run this AFTER the foreign key indexes migration

-- =============================================
-- BOOKINGS TABLE - Composite Indexes
-- =============================================

-- Warehouse + Status: For listing active bookings per warehouse
CREATE INDEX IF NOT EXISTS idx_bookings_warehouse_status 
ON bookings(warehouse_id, booking_status);

-- Customer + Created: For customer booking history (newest first)
CREATE INDEX IF NOT EXISTS idx_bookings_customer_created 
ON bookings(customer_id, created_at DESC);

-- Warehouse + Dates: For availability checking
CREATE INDEX IF NOT EXISTS idx_bookings_warehouse_dates 
ON bookings(warehouse_id, start_date, end_date);

-- Status only: Partial index for active bookings
CREATE INDEX IF NOT EXISTS idx_bookings_active_status 
ON bookings(booking_status) 
WHERE booking_status IN ('pending', 'active', 'confirmed', 'awaiting_time_slot');

-- Warehouse + Active only: Most common query
CREATE INDEX IF NOT EXISTS idx_bookings_warehouse_active 
ON bookings(warehouse_id) 
WHERE booking_status IN ('pending', 'active', 'confirmed', 'awaiting_time_slot');

-- =============================================
-- INVENTORY_ITEMS TABLE - Composite Indexes
-- =============================================

-- Warehouse + Status: For warehouse inventory listing
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_status 
ON inventory_items(warehouse_id, inventory_item_status);

-- Customer + Warehouse: For customer's inventory at specific warehouse
CREATE INDEX IF NOT EXISTS idx_inventory_customer_warehouse 
ON inventory_items(customer_id, warehouse_id);

-- Pallet ID: For unique pallet lookups (if not already indexed)
CREATE INDEX IF NOT EXISTS idx_inventory_pallet_id 
ON inventory_items(pallet_id) 
WHERE pallet_id IS NOT NULL;

-- Active inventory only
CREATE INDEX IF NOT EXISTS idx_inventory_active 
ON inventory_items(warehouse_id, customer_id) 
WHERE inventory_item_status = 'stored';

-- =============================================
-- INVOICES TABLE - Composite Indexes
-- =============================================

-- Customer + Status: For customer invoice listing
CREATE INDEX IF NOT EXISTS idx_invoices_customer_status 
ON invoices(customer_id, invoice_status);

-- Due date for pending: For overdue invoice alerts
CREATE INDEX IF NOT EXISTS idx_invoices_pending_due 
ON invoices(due_date) 
WHERE invoice_status = 'pending';

-- =============================================
-- NOTIFICATIONS TABLE - Composite Indexes
-- =============================================

-- User + Read + Created: For unread notification listing
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, created_at DESC) 
WHERE read = false;

-- User + All: For full notification history
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications(user_id, created_at DESC);

-- =============================================
-- WAREHOUSE_AVAILABILITY TABLE - Composite Indexes
-- =============================================

-- Warehouse + Date: For availability queries
CREATE INDEX IF NOT EXISTS idx_availability_warehouse_date 
ON warehouse_availability(warehouse_id, date);

-- Zone availability
CREATE INDEX IF NOT EXISTS idx_availability_zone_date 
ON warehouse_availability(zone_id, date) 
WHERE zone_id IS NOT NULL;

-- =============================================
-- ACCESS_LOGS TABLE - Composite Indexes
-- =============================================

-- Warehouse + Date: For daily access reports
CREATE INDEX IF NOT EXISTS idx_access_logs_warehouse_date 
ON access_logs(warehouse_id, created_at DESC);

-- Person + Date: For person access history
CREATE INDEX IF NOT EXISTS idx_access_logs_person_date 
ON access_logs(person_id, created_at DESC) 
WHERE person_id IS NOT NULL;

-- =============================================
-- TASKS TABLE - Composite Indexes
-- =============================================

-- Assigned + Status: For user's pending tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status 
ON tasks(assigned_to, task_status) 
WHERE assigned_to IS NOT NULL;

-- Warehouse + Status: For warehouse task board
CREATE INDEX IF NOT EXISTS idx_tasks_warehouse_status 
ON tasks(warehouse_id, task_status) 
WHERE warehouse_id IS NOT NULL;

-- Due date for open tasks
CREATE INDEX IF NOT EXISTS idx_tasks_open_due 
ON tasks(due_date) 
WHERE task_status IN ('pending', 'in_progress');

-- =============================================
-- STAFF_TASKS TABLE - Composite Indexes
-- =============================================

-- Assigned + Status: For staff's pending tasks
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned_status 
ON staff_tasks(assigned_to, status);

-- Warehouse + Date: For daily task board
CREATE INDEX IF NOT EXISTS idx_staff_tasks_warehouse_date 
ON staff_tasks(warehouse_id, scheduled_date);

-- =============================================
-- PAYMENTS TABLE - Composite Indexes
-- =============================================

-- Customer + Status: For payment history
CREATE INDEX IF NOT EXISTS idx_payments_customer_status 
ON payments(customer_id, status) 
WHERE customer_id IS NOT NULL;

-- Created date: For financial reports
CREATE INDEX IF NOT EXISTS idx_payments_created 
ON payments(created_at DESC);

-- =============================================
-- WAREHOUSES TABLE - Composite Indexes
-- =============================================

-- City + Status: For search by location
CREATE INDEX IF NOT EXISTS idx_warehouses_city_status 
ON warehouses(city, status) 
WHERE status = true;

-- Owner + Status: For owner's warehouse listing
CREATE INDEX IF NOT EXISTS idx_warehouses_owner_status 
ON warehouses(owner_company_id, status) 
WHERE owner_company_id IS NOT NULL;

-- Full-text search on name and city
CREATE INDEX IF NOT EXISTS idx_warehouses_search 
ON warehouses USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(city, '')));

-- =============================================
-- AUDIT_LOGS TABLE - Composite Indexes
-- =============================================

-- User + Date: For user activity audit
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date 
ON audit_logs(user_id, created_at DESC) 
WHERE user_id IS NOT NULL;

-- Action + Date: For action-specific audit
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_date 
ON audit_logs(action, created_at DESC);

-- =============================================
-- CRM_CONTACTS TABLE - Composite Indexes
-- =============================================

-- Status + Priority: For lead management
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status_priority 
ON crm_contacts(status, priority);

-- Assigned + Status: For sales rep's leads
CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned_status 
ON crm_contacts(assigned_to, status) 
WHERE assigned_to IS NOT NULL;

-- =============================================
-- CLAIMS TABLE - Composite Indexes
-- =============================================

-- Customer + Status: For customer claims
CREATE INDEX IF NOT EXISTS idx_claims_customer_status 
ON claims(customer_id, claim_status);

-- =============================================
-- ANALYZE UPDATED TABLES
-- =============================================

ANALYZE bookings;
ANALYZE inventory_items;
ANALYZE invoices;
ANALYZE notifications;
ANALYZE warehouse_availability;
ANALYZE access_logs;
ANALYZE tasks;
ANALYZE staff_tasks;
ANALYZE payments;
ANALYZE warehouses;
ANALYZE audit_logs;
ANALYZE claims;
