-- Remove need_transportation column from warehouses table
-- Ports can be added directly without needing a checkbox

ALTER TABLE warehouses 
DROP COLUMN IF EXISTS need_transportation;

