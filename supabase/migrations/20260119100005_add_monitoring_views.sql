-- Migration: Add Monitoring Views
-- Description: Views for database health monitoring and performance analysis

-- =============================================
-- 1. TABLE SIZES VIEW
-- =============================================

CREATE OR REPLACE VIEW v_table_sizes AS
SELECT
    schemaname AS schema_name,
    relname AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,
    pg_total_relation_size(relid) AS total_bytes
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- =============================================
-- 2. INDEX USAGE VIEW
-- =============================================

CREATE OR REPLACE VIEW v_index_usage AS
SELECT
    schemaname AS schema_name,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    pg_relation_size(indexrelid) AS index_bytes,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED - Consider dropping'
        WHEN idx_scan < 10 THEN 'RARELY USED'
        ELSE 'ACTIVE'
    END AS usage_status
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- =============================================
-- 3. TABLE BLOAT ESTIMATE VIEW
-- =============================================

CREATE OR REPLACE VIEW v_table_bloat AS
SELECT
    schemaname AS schema_name,
    relname AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    CASE 
        WHEN n_live_tup > 0 THEN 
            ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
        ELSE 0 
    END AS bloat_percentage,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    CASE
        WHEN n_dead_tup > n_live_tup * 0.2 THEN 'VACUUM RECOMMENDED'
        WHEN last_vacuum IS NULL AND last_autovacuum IS NULL THEN 'NEVER VACUUMED'
        WHEN last_vacuum < CURRENT_TIMESTAMP - INTERVAL '7 days' 
             AND last_autovacuum < CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 'VACUUM OVERDUE'
        ELSE 'OK'
    END AS recommendation
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- =============================================
-- 4. ACTIVE CONNECTIONS VIEW
-- =============================================

CREATE OR REPLACE VIEW v_active_connections AS
SELECT
    pid,
    usename AS username,
    application_name,
    client_addr AS client_address,
    state,
    query_start,
    EXTRACT(EPOCH FROM (NOW() - query_start))::INT AS query_duration_seconds,
    LEFT(query, 100) AS query_preview,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE datname = current_database()
AND pid != pg_backend_pid()
ORDER BY query_start DESC;

-- =============================================
-- 5. LONG RUNNING QUERIES VIEW
-- =============================================

CREATE OR REPLACE VIEW v_long_running_queries AS
SELECT
    pid,
    usename AS username,
    application_name,
    state,
    query_start,
    EXTRACT(EPOCH FROM (NOW() - query_start))::INT AS duration_seconds,
    query,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE datname = current_database()
AND state != 'idle'
AND query_start < NOW() - INTERVAL '30 seconds'
AND pid != pg_backend_pid()
ORDER BY query_start ASC;

-- =============================================
-- 6. LOCK MONITORING VIEW
-- =============================================

CREATE OR REPLACE VIEW v_locks AS
SELECT
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_query,
    blocking_activity.query AS blocking_query,
    blocked_locks.locktype,
    blocked_locks.mode AS blocked_mode,
    blocking_locks.mode AS blocking_mode
FROM pg_locks blocked_locks
JOIN pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- =============================================
-- 7. DATABASE STATISTICS VIEW
-- =============================================

CREATE OR REPLACE VIEW v_database_stats AS
SELECT
    datname AS database_name,
    numbackends AS active_connections,
    xact_commit AS transactions_committed,
    xact_rollback AS transactions_rolled_back,
    blks_read AS blocks_read,
    blks_hit AS blocks_hit,
    CASE 
        WHEN (blks_read + blks_hit) > 0 
        THEN ROUND(100.0 * blks_hit / (blks_read + blks_hit), 2)
        ELSE 100 
    END AS cache_hit_ratio,
    tup_returned AS rows_returned,
    tup_fetched AS rows_fetched,
    tup_inserted AS rows_inserted,
    tup_updated AS rows_updated,
    tup_deleted AS rows_deleted,
    conflicts,
    temp_files,
    pg_size_pretty(temp_bytes) AS temp_bytes,
    deadlocks,
    stats_reset AS last_stats_reset
FROM pg_stat_database
WHERE datname = current_database();

-- =============================================
-- 8. HEALTH CHECK FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION check_database_health()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check 1: Connection count
    RETURN QUERY
    SELECT 
        'Connection Count'::TEXT,
        CASE WHEN COUNT(*) > 80 THEN 'WARNING' ELSE 'OK' END,
        COUNT(*)::TEXT || ' active connections'
    FROM pg_stat_activity WHERE datname = current_database();
    
    -- Check 2: Long running queries
    RETURN QUERY
    SELECT 
        'Long Running Queries'::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END,
        COUNT(*)::TEXT || ' queries running > 5 minutes'
    FROM pg_stat_activity 
    WHERE datname = current_database()
    AND state != 'idle'
    AND query_start < NOW() - INTERVAL '5 minutes';
    
    -- Check 3: Bloated tables
    RETURN QUERY
    SELECT 
        'Table Bloat'::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END,
        COUNT(*)::TEXT || ' tables with > 20% dead tuples'
    FROM pg_stat_user_tables 
    WHERE n_dead_tup > n_live_tup * 0.2 AND n_live_tup > 1000;
    
    -- Check 4: Unused indexes
    RETURN QUERY
    SELECT 
        'Unused Indexes'::TEXT,
        CASE WHEN COUNT(*) > 5 THEN 'INFO' ELSE 'OK' END,
        COUNT(*)::TEXT || ' indexes never used'
    FROM pg_stat_user_indexes 
    WHERE idx_scan = 0 
    AND pg_relation_size(indexrelid) > 1024 * 1024; -- > 1MB
    
    -- Check 5: Cache hit ratio
    RETURN QUERY
    SELECT 
        'Cache Hit Ratio'::TEXT,
        CASE 
            WHEN ROUND(100.0 * blks_hit / NULLIF(blks_read + blks_hit, 0), 2) < 90 THEN 'WARNING'
            ELSE 'OK' 
        END,
        ROUND(100.0 * blks_hit / NULLIF(blks_read + blks_hit, 0), 2)::TEXT || '%'
    FROM pg_stat_database WHERE datname = current_database();
    
    -- Check 6: Deadlocks
    RETURN QUERY
    SELECT 
        'Deadlocks (last reset)'::TEXT,
        CASE WHEN deadlocks > 0 THEN 'INFO' ELSE 'OK' END,
        deadlocks::TEXT || ' deadlocks since ' || COALESCE(stats_reset::TEXT, 'unknown')
    FROM pg_stat_database WHERE datname = current_database();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- GRANT ACCESS
-- =============================================

-- Only allow authenticated users with appropriate roles
GRANT SELECT ON v_table_sizes TO authenticated;
GRANT SELECT ON v_index_usage TO authenticated;
GRANT SELECT ON v_table_bloat TO authenticated;
GRANT SELECT ON v_database_stats TO authenticated;
-- Note: v_active_connections, v_long_running_queries, v_locks may contain sensitive info
-- Consider restricting to admin role only

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON VIEW v_table_sizes IS 'Shows size of all tables including indexes';
COMMENT ON VIEW v_index_usage IS 'Shows index usage statistics and identifies unused indexes';
COMMENT ON VIEW v_table_bloat IS 'Estimates table bloat and vacuum recommendations';
COMMENT ON VIEW v_active_connections IS 'Shows all active database connections';
COMMENT ON VIEW v_long_running_queries IS 'Shows queries running longer than 30 seconds';
COMMENT ON VIEW v_locks IS 'Shows blocking lock relationships';
COMMENT ON VIEW v_database_stats IS 'Overall database statistics including cache hit ratio';
COMMENT ON FUNCTION check_database_health() IS 'Quick health check returning status of key metrics';
