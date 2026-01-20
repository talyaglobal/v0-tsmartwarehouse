-- Maintenance Script: Vacuum and Analyze
-- Description: Regular maintenance for optimal database performance
-- Run: Weekly or after heavy write operations

-- =============================================
-- VACUUM ANALYZE - High Traffic Tables
-- =============================================

-- These tables have frequent writes, run aggressively
VACUUM (VERBOSE, ANALYZE) bookings;
VACUUM (VERBOSE, ANALYZE) inventory_items;
VACUUM (VERBOSE, ANALYZE) notifications;
VACUUM (VERBOSE, ANALYZE) access_logs;
VACUUM (VERBOSE, ANALYZE) audit_logs;

-- =============================================
-- VACUUM ANALYZE - Medium Traffic Tables
-- =============================================

VACUUM (VERBOSE, ANALYZE) invoices;
VACUUM (VERBOSE, ANALYZE) payments;
VACUUM (VERBOSE, ANALYZE) tasks;
VACUUM (VERBOSE, ANALYZE) staff_tasks;
VACUUM (VERBOSE, ANALYZE) inventory_movements;

-- =============================================
-- ANALYZE ONLY - Reference Tables
-- =============================================

ANALYZE warehouses;
ANALYZE profiles;
ANALYZE companies;
ANALYZE warehouse_staff;
ANALYZE company_members;
ANALYZE warehouse_availability;

-- =============================================
-- REINDEX - If needed (use sparingly)
-- =============================================

-- Uncomment if indexes are bloated (check v_index_usage first)
-- REINDEX TABLE CONCURRENTLY bookings;
-- REINDEX TABLE CONCURRENTLY inventory_items;
-- REINDEX TABLE CONCURRENTLY notifications;
