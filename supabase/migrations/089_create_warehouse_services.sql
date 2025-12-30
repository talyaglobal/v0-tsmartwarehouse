-- Create warehouse_services table for custom services per warehouse
CREATE TABLE IF NOT EXISTS warehouse_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_description TEXT,
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('one_time', 'per_pallet', 'per_sqft', 'per_day', 'per_month')),
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_warehouse_services_warehouse_id ON warehouse_services(warehouse_id);
CREATE INDEX idx_warehouse_services_active ON warehouse_services(warehouse_id, is_active);

-- Enable RLS
ALTER TABLE warehouse_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public can view active services for a warehouse (for booking)
CREATE POLICY "Anyone can view active warehouse services"
  ON warehouse_services
  FOR SELECT
  USING (is_active = true);

-- Warehouse owners can manage their own warehouse services
CREATE POLICY "Warehouse owners can insert their own services"
  ON warehouse_services
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warehouses w
      INNER JOIN profiles p ON p.company_id = w.owner_company_id
      WHERE w.id = warehouse_services.warehouse_id
        AND p.id = auth.uid()
        AND p.status = true
    )
  );

CREATE POLICY "Warehouse owners can update their own services"
  ON warehouse_services
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM warehouses w
      INNER JOIN profiles p ON p.company_id = w.owner_company_id
      WHERE w.id = warehouse_services.warehouse_id
        AND p.id = auth.uid()
        AND p.status = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warehouses w
      INNER JOIN profiles p ON p.company_id = w.owner_company_id
      WHERE w.id = warehouse_services.warehouse_id
        AND p.id = auth.uid()
        AND p.status = true
    )
  );

CREATE POLICY "Warehouse owners can delete their own services"
  ON warehouse_services
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM warehouses w
      INNER JOIN profiles p ON p.company_id = w.owner_company_id
      WHERE w.id = warehouse_services.warehouse_id
        AND p.id = auth.uid()
        AND p.status = true
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_warehouse_services_updated_at
  BEFORE UPDATE ON warehouse_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE warehouse_services IS 'Custom services that can be added to bookings, defined per warehouse';
COMMENT ON COLUMN warehouse_services.pricing_type IS 'How the service is priced: one_time, per_pallet, per_sqft, per_day, per_month';
COMMENT ON COLUMN warehouse_services.base_price IS 'Base price for the service based on pricing_type';
COMMENT ON COLUMN warehouse_services.is_active IS 'Whether the service is currently available for booking';
