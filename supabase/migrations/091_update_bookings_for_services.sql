-- Update bookings table to track service amounts separately
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS services_amount NUMERIC(10,2) DEFAULT 0 CHECK (services_amount >= 0);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS base_storage_amount NUMERIC(10,2);

-- Add comments
COMMENT ON COLUMN bookings.base_storage_amount IS 'Storage rental price (before services)';
COMMENT ON COLUMN bookings.services_amount IS 'Sum of all selected services for this booking';
COMMENT ON COLUMN bookings.total_amount IS 'Total amount = base_storage_amount + services_amount';

-- Create a function to update services_amount when booking_services change
CREATE OR REPLACE FUNCTION update_booking_services_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate services_amount for the booking
  UPDATE bookings
  SET services_amount = (
    SELECT COALESCE(SUM(calculated_price), 0)
    FROM booking_services
    WHERE booking_id = COALESCE(NEW.booking_id, OLD.booking_id)
  ),
  total_amount = base_storage_amount + (
    SELECT COALESCE(SUM(calculated_price), 0)
    FROM booking_services
    WHERE booking_id = COALESCE(NEW.booking_id, OLD.booking_id)
  )
  WHERE id = COALESCE(NEW.booking_id, OLD.booking_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update booking amounts when services change
CREATE TRIGGER update_booking_services_amount_trigger
  AFTER INSERT OR UPDATE OR DELETE ON booking_services
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_services_amount();

COMMENT ON FUNCTION update_booking_services_amount IS 'Automatically updates booking services_amount and total_amount when booking_services change';
