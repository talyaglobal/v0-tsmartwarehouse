-- Migration: Fix goods_type constraint after column rename
-- The warehouse_type column was renamed to goods_type, but the constraint still references the old column name

-- Step 1: Drop the old constraint that references warehouse_type
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_warehouse_type_check CASCADE;

-- Step 2: Drop any existing goods_type constraint
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_goods_type_check CASCADE;

-- Step 3: Drop any index that references the old column name
DROP INDEX IF EXISTS idx_warehouses_warehouse_type_gin;

-- Step 4: Add new constraint for goods_type column with ALL valid values
ALTER TABLE warehouses ADD CONSTRAINT warehouses_goods_type_check
CHECK (
  goods_type <@ ARRAY[
    'general',
    'general-dry-ambient',
    'food-beverage-fda',
    'pharmaceutical-fda-cgmp',
    'medical-devices-fda',
    'nutraceuticals-supplements-fda',
    'cosmetics-fda',
    'hazardous-materials-hazmat',
    'cold-storage',
    'alcohol-tobacco-ttb',
    'consumer-electronics',
    'automotive-parts',
    'ecommerce-high-velocity',
    'spare-parts',
    'aerospace-civil',
    'aerospace-pentagon-approved'
  ]::text[]
);

-- Step 5: Create GIN index for array searches on goods_type
CREATE INDEX IF NOT EXISTS idx_warehouses_goods_type_gin 
ON warehouses USING GIN(goods_type);

-- Step 6: Update comment
COMMENT ON CONSTRAINT warehouses_goods_type_check ON warehouses IS 'Ensures goods_type array only contains valid values';
