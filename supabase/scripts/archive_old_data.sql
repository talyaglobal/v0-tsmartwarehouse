-- Maintenance Script: Data Archival
-- Description: Archive old data to maintain performance
-- Run: Monthly

-- =============================================
-- 1. ARCHIVE OLD AUDIT LOGS (> 1 year)
-- =============================================

-- Create archive table if not exists
CREATE TABLE IF NOT EXISTS audit_logs_archive (LIKE audit_logs INCLUDING ALL);

-- Move old records (dry run - shows count)
SELECT COUNT(*) as records_to_archive
FROM audit_logs 
WHERE created_at < CURRENT_DATE - INTERVAL '1 year';

-- Uncomment to actually archive
/*
BEGIN;

-- Insert into archive
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE created_at < CURRENT_DATE - INTERVAL '1 year';

-- Delete from main table
DELETE FROM audit_logs
WHERE created_at < CURRENT_DATE - INTERVAL '1 year';

COMMIT;
*/

-- =============================================
-- 2. DELETE OLD NOTIFICATIONS (> 6 months)
-- =============================================

-- Dry run
SELECT COUNT(*) as notifications_to_delete
FROM notifications
WHERE created_at < CURRENT_DATE - INTERVAL '6 months'
AND read = true;

-- Uncomment to delete
/*
DELETE FROM notifications
WHERE created_at < CURRENT_DATE - INTERVAL '6 months'
AND read = true;
*/

-- =============================================
-- 3. ARCHIVE COMPLETED BOOKINGS (> 1 year)
-- =============================================

-- Create archive table if not exists
CREATE TABLE IF NOT EXISTS bookings_archive (LIKE bookings INCLUDING ALL);

-- Dry run
SELECT COUNT(*) as bookings_to_archive
FROM bookings
WHERE booking_status = 'completed'
AND updated_at < CURRENT_DATE - INTERVAL '1 year';

-- Uncomment to archive
/*
BEGIN;

-- Archive related data first (if needed)
-- INSERT INTO booking_services_archive SELECT * FROM booking_services WHERE booking_id IN (...)

INSERT INTO bookings_archive
SELECT * FROM bookings
WHERE booking_status = 'completed'
AND updated_at < CURRENT_DATE - INTERVAL '1 year';

-- Soft delete from main table (or hard delete if archived)
UPDATE bookings 
SET booking_status = 'archived'
WHERE booking_status = 'completed'
AND updated_at < CURRENT_DATE - INTERVAL '1 year';

COMMIT;
*/

-- =============================================
-- 4. CLEANUP EMAIL EVENTS (> 3 months)
-- =============================================

-- Dry run
SELECT COUNT(*) as email_events_to_delete
FROM email_events
WHERE timestamp < CURRENT_DATE - INTERVAL '3 months';

-- Uncomment to delete
/*
DELETE FROM email_events
WHERE timestamp < CURRENT_DATE - INTERVAL '3 months';
*/

-- =============================================
-- 5. SUMMARY REPORT
-- =============================================

SELECT 
    'audit_logs' as table_name,
    (SELECT COUNT(*) FROM audit_logs WHERE created_at < CURRENT_DATE - INTERVAL '1 year') as archivable_count,
    '1 year' as retention_period
UNION ALL
SELECT 
    'notifications',
    (SELECT COUNT(*) FROM notifications WHERE created_at < CURRENT_DATE - INTERVAL '6 months' AND read = true),
    '6 months (read only)'
UNION ALL
SELECT 
    'bookings (completed)',
    (SELECT COUNT(*) FROM bookings WHERE booking_status = 'completed' AND updated_at < CURRENT_DATE - INTERVAL '1 year'),
    '1 year'
UNION ALL
SELECT 
    'email_events',
    (SELECT COUNT(*) FROM email_events WHERE timestamp < CURRENT_DATE - INTERVAL '3 months'),
    '3 months';
