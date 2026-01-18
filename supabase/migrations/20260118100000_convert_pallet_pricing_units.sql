-- Convert existing pallet pricing data from inches/lbs to cm/kg
-- This migration fixes the unit mismatch issue where values were stored in inches/lbs
-- but the database columns are named height_min_cm, height_max_cm, weight_min_kg, weight_max_kg

-- Step 1: Convert height ranges from inches to cm (multiply by 2.54)
-- Only for standard pallet type (euro pallet values are already in cm)
UPDATE warehouse_pallet_height_pricing hp
SET 
  height_min_cm = height_min_cm * 2.54,
  height_max_cm = height_max_cm * 2.54
FROM warehouse_pallet_pricing pp
WHERE hp.pallet_pricing_id = pp.id
  AND pp.pallet_type IN ('standard', 'custom')
  AND hp.height_max_cm < 500;  -- Safety check: only convert if values look like inches (< 500)

-- Step 2: Convert weight ranges from lbs to kg (multiply by 0.453592)
-- Only for standard pallet type (euro pallet values are already in kg)
UPDATE warehouse_pallet_weight_pricing wp
SET 
  weight_min_kg = weight_min_kg * 0.453592,
  weight_max_kg = weight_max_kg * 0.453592
FROM warehouse_pallet_pricing pp
WHERE wp.pallet_pricing_id = pp.id
  AND pp.pallet_type IN ('standard', 'custom')
  AND wp.weight_max_kg < 5000;  -- Safety check: only convert if values look like lbs (< 5000)

-- Step 3: Convert custom pallet size height ranges
UPDATE warehouse_custom_pallet_size_height_pricing cshp
SET 
  height_min_cm = height_min_cm * 2.54,
  height_max_cm = height_max_cm * 2.54
FROM warehouse_custom_pallet_sizes cs
INNER JOIN warehouse_pallet_pricing pp ON cs.pallet_pricing_id = pp.id
WHERE cshp.custom_pallet_size_id = cs.id
  AND pp.pallet_type = 'custom'
  AND cshp.height_max_cm < 500;  -- Safety check: only convert if values look like inches

-- Step 4: Convert custom pallet size dimensions
UPDATE warehouse_custom_pallet_sizes cs
SET 
  length_cm = CASE WHEN length_cm IS NOT NULL AND length_cm < 200 THEN length_cm * 2.54 ELSE length_cm END,
  width_cm = CASE WHEN width_cm IS NOT NULL AND width_cm < 200 THEN width_cm * 2.54 ELSE width_cm END,
  length_min_cm = CASE WHEN length_min_cm IS NOT NULL AND length_min_cm < 200 THEN length_min_cm * 2.54 ELSE length_min_cm END,
  length_max_cm = CASE WHEN length_max_cm IS NOT NULL AND length_max_cm < 200 THEN length_max_cm * 2.54 ELSE length_max_cm END,
  width_min_cm = CASE WHEN width_min_cm IS NOT NULL AND width_min_cm < 200 THEN width_min_cm * 2.54 ELSE width_min_cm END,
  width_max_cm = CASE WHEN width_max_cm IS NOT NULL AND width_max_cm < 200 THEN width_max_cm * 2.54 ELSE width_max_cm END
FROM warehouse_pallet_pricing pp
WHERE cs.pallet_pricing_id = pp.id
  AND pp.pallet_type = 'custom';

-- Add a comment to track this migration
COMMENT ON TABLE warehouse_pallet_height_pricing IS 'Height values stored in centimeters (cm). Migrated from inches on 2026-01-18.';
COMMENT ON TABLE warehouse_pallet_weight_pricing IS 'Weight values stored in kilograms (kg). Migrated from lbs on 2026-01-18.';
