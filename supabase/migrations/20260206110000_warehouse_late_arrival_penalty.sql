-- Gecikme cezası: Depo sahibi X süre (dk/saat/gün) gecikmeden sonra Y tutar ceza tanımlar.
-- Örnek: 8:30 randevu, 9:30 geldi → X dk aşıldıysa Y birim ceza.

ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS late_arrival_grace_minutes INTEGER CHECK (late_arrival_grace_minutes IS NULL OR late_arrival_grace_minutes >= 0),
  ADD COLUMN IF NOT EXISTS late_arrival_penalty_amount NUMERIC(10,2) CHECK (late_arrival_penalty_amount IS NULL OR late_arrival_penalty_amount >= 0),
  ADD COLUMN IF NOT EXISTS late_arrival_penalty_type TEXT CHECK (late_arrival_penalty_type IS NULL OR late_arrival_penalty_type IN ('flat', 'per_hour', 'per_day'));

COMMENT ON COLUMN warehouses.late_arrival_grace_minutes IS 'İzin verilen gecikme (dakika). Bu süre aşılırsa ceza uygulanır.';
COMMENT ON COLUMN warehouses.late_arrival_penalty_amount IS 'Ceza tutarı (birim: late_arrival_penalty_type a göre).';
COMMENT ON COLUMN warehouses.late_arrival_penalty_type IS 'flat=tek seferlik, per_hour=saat başı, per_day=gün başı.';
