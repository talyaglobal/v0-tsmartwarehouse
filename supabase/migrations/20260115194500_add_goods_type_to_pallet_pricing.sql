-- Add goods_type to pallet pricing for per-goods pricing
ALTER TABLE warehouse_pallet_pricing
ADD COLUMN IF NOT EXISTS goods_type TEXT NOT NULL DEFAULT 'general';

UPDATE warehouse_pallet_pricing
SET goods_type = LOWER(goods_type)
WHERE goods_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_pallet_pricing_goods_type
ON warehouse_pallet_pricing(goods_type);

COMMENT ON COLUMN warehouse_pallet_pricing.goods_type IS 'Goods type key for pallet pricing (lowercase)';
