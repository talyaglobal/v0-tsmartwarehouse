-- Migration 115: Add stackable column to warehouse_pallet_pricing
-- Created: 2025-01-XX
-- Purpose: Add stackable/unstackable option to pallet pricing

ALTER TABLE warehouse_pallet_pricing
ADD COLUMN IF NOT EXISTS stackable BOOLEAN DEFAULT true;

COMMENT ON COLUMN warehouse_pallet_pricing.stackable IS 'Whether pallets can be stacked (true) or must remain unstacked (false)';

