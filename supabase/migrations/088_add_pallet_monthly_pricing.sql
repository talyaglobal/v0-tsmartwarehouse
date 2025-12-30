-- Add 'pallet-monthly' to pricing_type enum
-- This allows warehouses to set monthly pallet pricing in addition to daily pricing

-- First, add the new value to the enum
ALTER TYPE pricing_type ADD VALUE IF NOT EXISTS 'pallet-monthly';

-- Update the check constraint on warehouse_pricing table if it exists
-- to include the new pricing type
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warehouse_pricing_pricing_type_check'
  ) THEN
    ALTER TABLE warehouse_pricing
    DROP CONSTRAINT warehouse_pricing_pricing_type_check;
  END IF;

  -- Add updated constraint
  ALTER TABLE warehouse_pricing
  ADD CONSTRAINT warehouse_pricing_pricing_type_check
  CHECK (pricing_type IN ('pallet', 'pallet-monthly', 'area', 'area-rental'));
END $$;

-- Add comment explaining the pricing logic
COMMENT ON TYPE pricing_type IS
'Pricing types for warehouse storage:
- pallet: Per pallet per day (used for bookings < 30 days)
- pallet-monthly: Per pallet per month (used for bookings >= 30 days)
- area: Per square foot per month
- area-rental: Alternative area pricing';
