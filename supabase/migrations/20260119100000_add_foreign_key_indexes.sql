-- Migration: Add Foreign Key Indexes
-- Description: Add indexes on foreign key columns for better join performance
-- Run this AFTER backing up the database

-- =============================================
-- BOOKINGS TABLE
-- =============================================

-- Customer lookup (very frequent)
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id 
ON bookings(customer_id);

-- Warehouse lookup (frequent for warehouse owners)
CREATE INDEX IF NOT EXISTS idx_bookings_warehouse_id 
ON bookings(warehouse_id);

-- Hall lookup (for capacity calculations)
CREATE INDEX IF NOT EXISTS idx_bookings_hall_id 
ON bookings(hall_id) 
WHERE hall_id IS NOT NULL;

-- Approved by lookup (admin queries)
CREATE INDEX IF NOT EXISTS idx_bookings_approved_by 
ON bookings(approved_by) 
WHERE approved_by IS NOT NULL;

-- Cancel requested by
CREATE INDEX IF NOT EXISTS idx_bookings_cancel_requested_by 
ON bookings(cancel_requested_by) 
WHERE cancel_requested_by IS NOT NULL;

-- Assigned driver
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_driver_id 
ON bookings(assigned_driver_id) 
WHERE assigned_driver_id IS NOT NULL;

-- =============================================
-- INVENTORY_ITEMS TABLE
-- =============================================

-- Customer inventory lookup
CREATE INDEX IF NOT EXISTS idx_inventory_items_customer_id 
ON inventory_items(customer_id);

-- Warehouse inventory lookup
CREATE INDEX IF NOT EXISTS idx_inventory_items_warehouse_id 
ON inventory_items(warehouse_id);

-- Booking reference
CREATE INDEX IF NOT EXISTS idx_inventory_items_booking_id 
ON inventory_items(booking_id) 
WHERE booking_id IS NOT NULL;

-- Floor lookup
CREATE INDEX IF NOT EXISTS idx_inventory_items_floor_id 
ON inventory_items(floor_id) 
WHERE floor_id IS NOT NULL;

-- Hall lookup
CREATE INDEX IF NOT EXISTS idx_inventory_items_hall_id 
ON inventory_items(hall_id) 
WHERE hall_id IS NOT NULL;

-- Zone lookup
CREATE INDEX IF NOT EXISTS idx_inventory_items_zone_id 
ON inventory_items(zone_id) 
WHERE zone_id IS NOT NULL;

-- =============================================
-- INVOICES TABLE
-- =============================================

-- Customer invoices lookup
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id 
ON invoices(customer_id);

-- Booking reference
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id 
ON invoices(booking_id) 
WHERE booking_id IS NOT NULL;

-- =============================================
-- ACCESS_LOGS TABLE
-- =============================================

-- Warehouse access logs
CREATE INDEX IF NOT EXISTS idx_access_logs_warehouse_id 
ON access_logs(warehouse_id);

-- Person lookup
CREATE INDEX IF NOT EXISTS idx_access_logs_person_id 
ON access_logs(person_id) 
WHERE person_id IS NOT NULL;

-- Checked in by
CREATE INDEX IF NOT EXISTS idx_access_logs_checked_in_by 
ON access_logs(checked_in_by) 
WHERE checked_in_by IS NOT NULL;

-- =============================================
-- TASKS TABLE
-- =============================================

-- Assigned user tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to 
ON tasks(assigned_to) 
WHERE assigned_to IS NOT NULL;

-- Warehouse tasks
CREATE INDEX IF NOT EXISTS idx_tasks_warehouse_id 
ON tasks(warehouse_id) 
WHERE warehouse_id IS NOT NULL;

-- Booking tasks
CREATE INDEX IF NOT EXISTS idx_tasks_booking_id 
ON tasks(booking_id) 
WHERE booking_id IS NOT NULL;

-- =============================================
-- SHIPMENTS TABLE
-- =============================================

-- Booking shipments
CREATE INDEX IF NOT EXISTS idx_shipments_booking_id 
ON shipments(booking_id) 
WHERE booking_id IS NOT NULL;

-- Driver shipments
CREATE INDEX IF NOT EXISTS idx_shipments_driver_id 
ON shipments(driver_id) 
WHERE driver_id IS NOT NULL;

-- Vehicle shipments
CREATE INDEX IF NOT EXISTS idx_shipments_vehicle_id 
ON shipments(vehicle_id) 
WHERE vehicle_id IS NOT NULL;

-- =============================================
-- STAFF_TASKS TABLE
-- =============================================

-- Assigned staff tasks
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned_to 
ON staff_tasks(assigned_to);

-- Warehouse staff tasks
CREATE INDEX IF NOT EXISTS idx_staff_tasks_warehouse_id 
ON staff_tasks(warehouse_id);

-- Booking staff tasks
CREATE INDEX IF NOT EXISTS idx_staff_tasks_booking_id 
ON staff_tasks(booking_id) 
WHERE booking_id IS NOT NULL;

-- =============================================
-- ADDITIONAL IMPORTANT FOREIGN KEYS
-- =============================================

-- Profiles company reference
CREATE INDEX IF NOT EXISTS idx_profiles_company_id 
ON profiles(company_id) 
WHERE company_id IS NOT NULL;

-- Warehouses owner company
CREATE INDEX IF NOT EXISTS idx_warehouses_owner_company_id 
ON warehouses(owner_company_id) 
WHERE owner_company_id IS NOT NULL;

-- Payments invoice reference
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id 
ON payments(invoice_id) 
WHERE invoice_id IS NOT NULL;

-- Payments customer reference
CREATE INDEX IF NOT EXISTS idx_payments_customer_id 
ON payments(customer_id) 
WHERE customer_id IS NOT NULL;

-- Company members
CREATE INDEX IF NOT EXISTS idx_company_members_company_id 
ON company_members(company_id);

CREATE INDEX IF NOT EXISTS idx_company_members_user_id 
ON company_members(user_id);

-- Warehouse staff
CREATE INDEX IF NOT EXISTS idx_warehouse_staff_warehouse_id 
ON warehouse_staff(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_staff_user_id 
ON warehouse_staff(user_id);

-- Notifications user
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
ON notifications(user_id);

-- Claims
CREATE INDEX IF NOT EXISTS idx_claims_booking_id 
ON claims(booking_id) 
WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_claims_customer_id 
ON claims(customer_id);

-- Incidents
CREATE INDEX IF NOT EXISTS idx_incidents_warehouse_id 
ON incidents(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_incidents_reported_by 
ON incidents(reported_by) 
WHERE reported_by IS NOT NULL;

-- CRM Tables
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company_id 
ON crm_contacts(company_id) 
WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned_to 
ON crm_contacts(assigned_to) 
WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id 
ON crm_activities(contact_id);

-- =============================================
-- ANALYZE TABLES AFTER INDEX CREATION
-- =============================================

ANALYZE bookings;
ANALYZE inventory_items;
ANALYZE invoices;
ANALYZE access_logs;
ANALYZE tasks;
ANALYZE shipments;
ANALYZE staff_tasks;
ANALYZE profiles;
ANALYZE warehouses;
ANALYZE payments;
ANALYZE company_members;
ANALYZE warehouse_staff;
ANALYZE notifications;
ANALYZE claims;
ANALYZE incidents;
