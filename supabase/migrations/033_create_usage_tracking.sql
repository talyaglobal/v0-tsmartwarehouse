-- Create booking usage tracking tables
-- This tracks monthly usage periods and daily usage for pro-rata billing

-- Booking usage periods table
CREATE TABLE IF NOT EXISTS booking_usage_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pallet_count INTEGER, -- For pallet bookings
  area_sq_ft INTEGER, -- For area rental bookings
  daily_usage JSONB, -- {date: {pallet_count, area_sq_ft}} for detailed tracking
  total_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, period_start)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_booking_usage_periods_booking_id ON booking_usage_periods(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_usage_periods_period_start ON booking_usage_periods(period_start);
CREATE INDEX IF NOT EXISTS idx_booking_usage_periods_period_end ON booking_usage_periods(period_end);

-- Enable Row Level Security
ALTER TABLE booking_usage_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Customers can view usage for their bookings
CREATE POLICY "Customers can view own usage"
  ON booking_usage_periods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_usage_periods.booking_id
      AND bookings.customer_id = auth.uid()
    )
  );

-- Warehouse owners can view usage for their warehouses
CREATE POLICY "Warehouse owners can view usage"
  ON booking_usage_periods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      JOIN warehouses ON warehouses.id = bookings.warehouse_id
      WHERE bookings.id = booking_usage_periods.booking_id
      AND warehouses.owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- System can create/update usage periods (via triggers or server actions)
CREATE POLICY "Service role can manage usage"
  ON booking_usage_periods FOR ALL
  USING (auth.role() = 'service_role');

-- System admins can manage all usage
CREATE POLICY "Admins can manage all usage"
  ON booking_usage_periods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

