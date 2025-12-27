-- Update warehouse_type column comment to reflect new warehouse type options
-- Migration: 081_update_warehouse_type_comment.sql

COMMENT ON COLUMN warehouses.warehouse_type IS 'Array of warehouse types: general-dry-ambient, food-beverage-fda, pharmaceutical-fda-cgmp, medical-devices-fda, nutraceuticals-supplements-fda, cosmetics-fda, hazardous-materials-hazmat, cold-storage, alcohol-tobacco-ttb, consumer-electronics, automotive-parts, ecommerce-high-velocity';

