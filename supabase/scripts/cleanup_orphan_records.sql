-- Maintenance Script: Orphan Record Cleanup
-- Description: Find and optionally remove orphan records
-- Run: Monthly or as needed

-- =============================================
-- DRY RUN MODE - Just report, don't delete
-- =============================================

-- Bookings with non-existent customers
SELECT 'bookings' as table_name, COUNT(*) as orphan_count
FROM bookings b
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = b.customer_id)
UNION ALL
-- Bookings with non-existent warehouses
SELECT 'bookings (warehouse)', COUNT(*)
FROM bookings b
WHERE NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.id = b.warehouse_id)
UNION ALL
-- Invoices with non-existent customers
SELECT 'invoices', COUNT(*)
FROM invoices i
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = i.customer_id)
UNION ALL
-- Inventory items with non-existent customers
SELECT 'inventory_items (customer)', COUNT(*)
FROM inventory_items ii
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = ii.customer_id)
UNION ALL
-- Inventory items with non-existent warehouses
SELECT 'inventory_items (warehouse)', COUNT(*)
FROM inventory_items ii
WHERE NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.id = ii.warehouse_id)
UNION ALL
-- Notifications with non-existent users
SELECT 'notifications', COUNT(*)
FROM notifications n
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = n.user_id)
UNION ALL
-- Company members with non-existent companies
SELECT 'company_members (company)', COUNT(*)
FROM company_members cm
WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = cm.company_id)
UNION ALL
-- Company members with non-existent users
SELECT 'company_members (user)', COUNT(*)
FROM company_members cm
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = cm.user_id)
UNION ALL
-- Warehouse staff with non-existent warehouses
SELECT 'warehouse_staff (warehouse)', COUNT(*)
FROM warehouse_staff ws
WHERE NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.id = ws.warehouse_id)
UNION ALL
-- Warehouse staff with non-existent users
SELECT 'warehouse_staff (user)', COUNT(*)
FROM warehouse_staff ws
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = ws.user_id);

-- =============================================
-- EXECUTE MODE - Uncomment to actually delete
-- =============================================

/*
-- WARNING: Backup database before running!

BEGIN;

-- Delete orphan notifications
DELETE FROM notifications n
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = n.user_id);

-- Delete orphan company members
DELETE FROM company_members cm
WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = cm.company_id)
   OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = cm.user_id);

-- Delete orphan warehouse staff
DELETE FROM warehouse_staff ws
WHERE NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.id = ws.warehouse_id)
   OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = ws.user_id);

-- For bookings and invoices, we typically don't delete - flag for review instead
-- UPDATE bookings SET booking_status = 'orphaned' WHERE ...

COMMIT;
*/
