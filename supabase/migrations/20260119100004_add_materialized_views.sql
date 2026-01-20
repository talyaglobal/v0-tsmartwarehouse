-- Migration: Add Materialized Views for Dashboard Performance
-- Description: Pre-computed views for frequently accessed dashboard data

-- =============================================
-- 1. WAREHOUSE CAPACITY SUMMARY VIEW
-- =============================================

DROP MATERIALIZED VIEW IF EXISTS mv_warehouse_capacity_summary;

CREATE MATERIALIZED VIEW mv_warehouse_capacity_summary AS
SELECT 
    w.id AS warehouse_id,
    w.name AS warehouse_name,
    w.city,
    w.owner_company_id,
    COALESCE(w.total_pallet_storage, 0) AS total_pallet_slots,
    COALESCE(
        (SELECT SUM(COALESCE(b.pallet_count, 0))
         FROM bookings b
         WHERE b.warehouse_id = w.id
         AND b.booking_status IN ('active', 'confirmed')),
        0
    )::INT AS used_pallet_slots,
    GREATEST(0, COALESCE(w.total_pallet_storage, 0) - COALESCE(
        (SELECT SUM(COALESCE(b.pallet_count, 0))
         FROM bookings b
         WHERE b.warehouse_id = w.id
         AND b.booking_status IN ('active', 'confirmed')),
        0
    ))::INT AS available_pallet_slots,
    COALESCE(w.total_sq_ft, 0) AS total_sq_ft,
    COALESCE(w.available_sq_ft, 0) AS available_sq_ft,
    CASE 
        WHEN COALESCE(w.total_pallet_storage, 0) > 0 THEN
            ROUND(
                (COALESCE(
                    (SELECT SUM(COALESCE(b.pallet_count, 0))
                     FROM bookings b
                     WHERE b.warehouse_id = w.id
                     AND b.booking_status IN ('active', 'confirmed')),
                    0
                )::NUMERIC / w.total_pallet_storage) * 100, 
                2
            )
        ELSE 0
    END AS utilization_percentage,
    (SELECT COUNT(*) FROM bookings b WHERE b.warehouse_id = w.id AND b.booking_status = 'active') AS active_bookings,
    now() AS last_updated
FROM warehouses w
WHERE w.status = true;

-- Indexes on materialized view
CREATE UNIQUE INDEX idx_mv_warehouse_capacity_id ON mv_warehouse_capacity_summary(warehouse_id);
CREATE INDEX idx_mv_warehouse_capacity_owner ON mv_warehouse_capacity_summary(owner_company_id);
CREATE INDEX idx_mv_warehouse_capacity_city ON mv_warehouse_capacity_summary(city);

-- =============================================
-- 2. CUSTOMER STATISTICS VIEW
-- =============================================

DROP MATERIALIZED VIEW IF EXISTS mv_customer_statistics;

CREATE MATERIALIZED VIEW mv_customer_statistics AS
SELECT 
    p.id AS customer_id,
    p.email AS customer_name,
    p.email,
    p.company_id,
    COUNT(DISTINCT b.id) AS total_bookings,
    COUNT(DISTINCT CASE WHEN b.booking_status IN ('active', 'confirmed') THEN b.id END) AS active_bookings,
    COALESCE(SUM(CASE WHEN b.booking_status IN ('active', 'confirmed') THEN b.pallet_count ELSE 0 END), 0)::INT AS total_pallets_stored,
    COALESCE(
        (SELECT SUM(total) FROM invoices i WHERE i.customer_id = p.id AND i.invoice_status = 'paid'),
        0
    ) AS total_spent,
    COALESCE(
        (SELECT SUM(total) FROM invoices i WHERE i.customer_id = p.id AND i.invoice_status = 'pending'),
        0
    ) AS pending_payments,
    (SELECT MAX(created_at) FROM bookings b2 WHERE b2.customer_id = p.id) AS last_booking_date,
    (SELECT COUNT(*) FROM inventory_items ii WHERE ii.customer_id = p.id AND ii.inventory_item_status = 'stored') AS items_in_storage,
    now() AS last_updated
FROM profiles p
LEFT JOIN bookings b ON b.customer_id = p.id
WHERE p.role IN ('customer', 'company_owner', 'company_admin', 'company_member')
GROUP BY p.id, p.email, p.company_id;

-- Indexes on materialized view
CREATE UNIQUE INDEX idx_mv_customer_stats_id ON mv_customer_statistics(customer_id);
CREATE INDEX idx_mv_customer_stats_company ON mv_customer_statistics(company_id);
CREATE INDEX idx_mv_customer_stats_active ON mv_customer_statistics(active_bookings DESC);

-- =============================================
-- 3. DAILY WAREHOUSE METRICS VIEW
-- =============================================

DROP MATERIALIZED VIEW IF EXISTS mv_daily_warehouse_metrics;

CREATE MATERIALIZED VIEW mv_daily_warehouse_metrics AS
SELECT 
    w.id AS warehouse_id,
    w.name AS warehouse_name,
    d.date AS metric_date,
    COALESCE(
        (SELECT COUNT(*) FROM access_logs al 
         WHERE al.warehouse_id = w.id 
         AND DATE(al.created_at) = d.date),
        0
    )::INT AS check_ins,
    0::INT AS check_outs,
    COALESCE(
        (SELECT COUNT(*) FROM bookings b 
         WHERE b.warehouse_id = w.id 
         AND DATE(b.created_at) = d.date),
        0
    )::INT AS new_bookings,
    COALESCE(
        (SELECT COUNT(*) FROM bookings b 
         WHERE b.warehouse_id = w.id 
         AND b.booking_status = 'completed'
         AND DATE(b.updated_at) = d.date),
        0
    )::INT AS completed_bookings,
    COALESCE(
        (SELECT SUM(amount) FROM payments p 
         WHERE DATE(p.created_at) = d.date),
        0
    ) AS revenue,
    now() AS last_updated
FROM warehouses w
CROSS JOIN (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE,
        '1 day'::interval
    )::date AS date
) d
WHERE w.status = true;

-- Indexes on materialized view
CREATE INDEX idx_mv_daily_metrics_warehouse_date ON mv_daily_warehouse_metrics(warehouse_id, metric_date DESC);
CREATE INDEX idx_mv_daily_metrics_date ON mv_daily_warehouse_metrics(metric_date DESC);

-- =============================================
-- 4. MONTHLY REVENUE SUMMARY VIEW
-- =============================================

DROP MATERIALIZED VIEW IF EXISTS mv_monthly_revenue_summary;

CREATE MATERIALIZED VIEW mv_monthly_revenue_summary AS
SELECT 
    DATE_TRUNC('month', p.created_at) AS month,
    COUNT(DISTINCT p.id) AS payment_count,
    SUM(p.amount) AS total_revenue,
    COUNT(DISTINCT i.customer_id) AS unique_customers,
    COUNT(DISTINCT i.booking_id) AS bookings_paid,
    now() AS last_updated
FROM payments p
JOIN invoices i ON i.id = p.invoice_id
WHERE p.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', p.created_at);

-- Indexes
CREATE INDEX idx_mv_monthly_revenue_month ON mv_monthly_revenue_summary(month DESC);

-- =============================================
-- REFRESH FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION refresh_warehouse_capacity_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_warehouse_capacity_summary;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_customer_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_statistics;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_daily_warehouse_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_warehouse_metrics;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_monthly_revenue_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_revenue_summary;
END;
$$ LANGUAGE plpgsql;

-- Master refresh function
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    PERFORM refresh_warehouse_capacity_summary();
    PERFORM refresh_customer_statistics();
    PERFORM refresh_daily_warehouse_metrics();
    PERFORM refresh_monthly_revenue_summary();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SCHEDULE REFRESH (using pg_cron if available)
-- =============================================

-- Note: pg_cron must be enabled in Supabase dashboard
-- These commands will fail silently if pg_cron is not available

DO $$
BEGIN
    -- Refresh capacity every 5 minutes
    PERFORM cron.schedule('refresh_capacity', '*/5 * * * *', 'SELECT refresh_warehouse_capacity_summary()');
    
    -- Refresh customer stats every hour
    PERFORM cron.schedule('refresh_customer_stats', '0 * * * *', 'SELECT refresh_customer_statistics()');
    
    -- Refresh daily metrics at midnight
    PERFORM cron.schedule('refresh_daily_metrics', '0 0 * * *', 'SELECT refresh_daily_warehouse_metrics()');
    
    -- Refresh monthly revenue at 1am on 1st of month
    PERFORM cron.schedule('refresh_monthly_revenue', '0 1 1 * *', 'SELECT refresh_monthly_revenue_summary()');
EXCEPTION WHEN others THEN
    RAISE NOTICE 'pg_cron not available - manual refresh required';
END $$;

-- =============================================
-- GRANT ACCESS
-- =============================================

-- Allow authenticated users to read materialized views
GRANT SELECT ON mv_warehouse_capacity_summary TO authenticated;
GRANT SELECT ON mv_customer_statistics TO authenticated;
GRANT SELECT ON mv_daily_warehouse_metrics TO authenticated;
GRANT SELECT ON mv_monthly_revenue_summary TO authenticated;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON MATERIALIZED VIEW mv_warehouse_capacity_summary IS 
'Pre-computed warehouse capacity and utilization data. Refresh every 5 minutes.';

COMMENT ON MATERIALIZED VIEW mv_customer_statistics IS 
'Aggregated customer statistics including bookings, spending, and inventory. Refresh hourly.';

COMMENT ON MATERIALIZED VIEW mv_daily_warehouse_metrics IS 
'Daily operational metrics per warehouse. Refresh daily at midnight.';

COMMENT ON MATERIALIZED VIEW mv_monthly_revenue_summary IS 
'Monthly revenue breakdown per warehouse. Refresh monthly.';
