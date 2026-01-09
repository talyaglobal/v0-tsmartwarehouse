-- Migration: Update overtime_price structure
-- Purpose: Change from per-hour pricing to per-pallet in/out pricing
-- Old structure: { outsideWorkingHours: number, outsideWorkingDays: number, holidays: number }
-- New structure: { afterRegularWorkTime: { in: number, out: number }, holidays: { in: number, out: number } }

-- Note: This migration doesn't need to migrate existing data as the structure is completely different
-- Existing overtime_price data will be reset to null

-- The column is already JSONB, so we just need to update the structure in the application code
-- No database schema changes needed - just update the application to use the new structure

COMMENT ON COLUMN warehouses.overtime_price IS 'JSONB object with overtime pricing: {"afterRegularWorkTime": {"in": number, "out": number}, "holidays": {"in": number, "out": number}}';

