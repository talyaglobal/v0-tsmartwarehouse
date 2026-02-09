-- Estimates, Invoice Templates, Cash Collection & Service min_price
-- Flow: Orders -> Estimate -> Invoice -> Cash Collection

-- ============================================
-- ESTIMATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_number TEXT NOT NULL UNIQUE,
  service_order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  estimate_status TEXT NOT NULL DEFAULT 'draft' CHECK (estimate_status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  due_date DATE,
  valid_until DATE,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_interval TEXT CHECK (recurring_interval IS NULL OR recurring_interval IN ('monthly', 'quarterly')),
  estimate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_estimates_customer_id ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_service_order_id ON estimates(service_order_id);
CREATE INDEX IF NOT EXISTS idx_estimates_booking_id ON estimates(booking_id);
CREATE INDEX IF NOT EXISTS idx_estimates_estimate_status ON estimates(estimate_status);
CREATE INDEX IF NOT EXISTS idx_estimates_estimate_date ON estimates(estimate_date);
CREATE INDEX IF NOT EXISTS idx_estimates_is_recurring ON estimates(is_recurring) WHERE is_recurring = true;

-- Generate estimate number EST-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION generate_estimate_number()
RETURNS TRIGGER AS $$
DECLARE
  new_number TEXT;
  exists_check INTEGER;
BEGIN
  IF NEW.estimate_number IS NOT NULL AND NEW.estimate_number != '' THEN
    RETURN NEW;
  END IF;
  LOOP
    new_number := 'EST-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT COUNT(*) INTO exists_check FROM estimates WHERE estimate_number = new_number;
    EXIT WHEN exists_check = 0;
  END LOOP;
  NEW.estimate_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_estimate_number ON estimates;
CREATE TRIGGER trigger_estimate_number
  BEFORE INSERT ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION generate_estimate_number();

-- ============================================
-- INVOICE TEMPLATES TABLE (for PDF/email)
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  html_content TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_templates_company_id ON invoice_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_is_system ON invoice_templates(is_system);

-- Insert default system template
INSERT INTO invoice_templates (id, name, description, is_system, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Default Invoice',
  'Standard invoice layout with company header and line items',
  true,
  true
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ADD estimate_id TO INVOICES
-- ============================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_estimate_id ON invoices(estimate_id) WHERE estimate_id IS NOT NULL;

-- ============================================
-- COMPANY_SERVICES: min_price, allow_custom_price
-- ============================================
ALTER TABLE company_services ADD COLUMN IF NOT EXISTS min_price NUMERIC(10,2) CHECK (min_price IS NULL OR min_price >= 0);
ALTER TABLE company_services ADD COLUMN IF NOT EXISTS allow_custom_price BOOLEAN NOT NULL DEFAULT true;
COMMENT ON COLUMN company_services.min_price IS 'Minimum price for this service; custom price must be >= min_price when allow_custom_price is true';
COMMENT ON COLUMN company_services.allow_custom_price IS 'If true, user can enter custom price (subject to min_price)';

-- ============================================
-- RLS ESTIMATES
-- ============================================
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and company can view estimates" ON estimates;
CREATE POLICY "Admins and company can view estimates"
  ON estimates FOR SELECT
  USING (
    status = true AND (
      auth.uid() = customer_id
      OR public.is_company_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'root')
    )
  );

DROP POLICY IF EXISTS "Admins and company can insert estimates" ON estimates;
CREATE POLICY "Admins and company can insert estimates"
  ON estimates FOR INSERT
  WITH CHECK (
    public.is_company_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'root')
  );

DROP POLICY IF EXISTS "Admins and company can update estimates" ON estimates;
CREATE POLICY "Admins and company can update estimates"
  ON estimates FOR UPDATE
  USING (
    status = true AND (
      public.is_company_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'root')
    )
  );

-- ============================================
-- RLS INVOICE_TEMPLATES (read for all authenticated, write for admin)
-- ============================================
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view active templates" ON invoice_templates;
CREATE POLICY "Authenticated can view active templates"
  ON invoice_templates FOR SELECT
  USING (
    is_active = true AND (
      is_system = true
      OR company_id IS NULL
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.company_id = invoice_templates.company_id AND p.id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can manage invoice templates" ON invoice_templates;
CREATE POLICY "Admins can manage invoice templates"
  ON invoice_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.role = 'root' OR p.role = 'warehouse_admin'))
  );

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS update_estimates_updated_at ON estimates;
CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoice_templates_updated_at ON invoice_templates;
CREATE TRIGGER update_invoice_templates_updated_at
  BEFORE UPDATE ON invoice_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CASH COLLECTION: use existing payments table;
-- view cash_collections can aggregate by invoice
-- ============================================
COMMENT ON TABLE estimates IS 'Price estimates before invoice; flow: Order -> Estimate -> Invoice -> Cash collection';
COMMENT ON TABLE invoice_templates IS 'Templates for invoice PDF/email (Resend)';
