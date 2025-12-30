-- Create booking_services table (pivot table for booking-service relationship)
CREATE TABLE IF NOT EXISTS booking_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES warehouse_services(id) ON DELETE RESTRICT,

  -- Snapshot fields for historical data (in case service is edited/deleted later)
  service_name TEXT NOT NULL,
  service_description TEXT,
  pricing_type TEXT NOT NULL,
  base_price NUMERIC(10,2) NOT NULL,

  -- Calculation fields
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0), -- For services that need quantity
  calculated_price NUMERIC(10,2) NOT NULL CHECK (calculated_price >= 0), -- Final price for this service

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate services in same booking
  UNIQUE(booking_id, service_id)
);

-- Create indexes
CREATE INDEX idx_booking_services_booking_id ON booking_services(booking_id);
CREATE INDEX idx_booking_services_service_id ON booking_services(service_id);

-- Enable RLS
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view services for their own bookings
CREATE POLICY "Users can view their own booking services"
  ON booking_services
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_services.booking_id
        AND (
          b.customer_id = auth.uid() -- Customer's own booking
          OR EXISTS ( -- Or warehouse owner's booking
            SELECT 1 FROM warehouses w
            INNER JOIN profiles p ON p.company_id = w.owner_company_id
            WHERE w.id = b.warehouse_id
              AND p.id = auth.uid()
              AND p.status = true
          )
        )
    )
  );

-- Services are automatically inserted when booking is created
CREATE POLICY "Services are inserted with booking"
  ON booking_services
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_services.booking_id
        AND b.customer_id = auth.uid()
    )
  );

-- No updates allowed (delete and recreate instead)
-- No direct deletes allowed (cascade delete when booking is deleted)

-- Add comments
COMMENT ON TABLE booking_services IS 'Services selected for each booking with snapshot of pricing at booking time';
COMMENT ON COLUMN booking_services.service_name IS 'Snapshot of service name at booking time';
COMMENT ON COLUMN booking_services.quantity IS 'Quantity for services priced per unit (e.g., number of pallets for shrink wrapping)';
COMMENT ON COLUMN booking_services.calculated_price IS 'Final calculated price for this service in this booking';
