-- Migration: Update role column comment - change "warehouse renters" to "warehouse clients"
-- Created: 2026-01-29
-- Purpose: Terminology consistency - use "warehouse clients" instead of "warehouse renters"

COMMENT ON COLUMN profiles.role IS 'User role: root (System Admin), warehouse_owner (Warehouse Owner), warehouse_admin (Warehouse Admin), warehouse_supervisor (Warehouse Supervisor), warehouse_client (Warehouse Client - customers who rent warehouse space), warehouse_staff (Warehouse Staff), warehouse_finder (Warehouse Finder), warehouse_broker (Warehouse Broker/Reseller), end_delivery_party (End Delivery Company), local_transport (Local Transport Company), international_transport (International Transport Company)';
