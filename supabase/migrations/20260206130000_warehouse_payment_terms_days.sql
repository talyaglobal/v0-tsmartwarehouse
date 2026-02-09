-- Her depo kendi finansal vadesini (ödeme vadesi) gün cinsinden belirleyebilir.
-- Örn. 30 = fatura tarihinden itibaren 30 gün içinde ödeme.

ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER CHECK (payment_terms_days IS NULL OR (payment_terms_days >= 0 AND payment_terms_days <= 365));

COMMENT ON COLUMN warehouses.payment_terms_days IS 'Finansal vade: fatura/kesinti tarihinden itibaren ödeme süresi (gün). Depo bazında belirlenir.';
