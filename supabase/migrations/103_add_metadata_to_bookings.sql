-- Add metadata JSONB column to bookings table
-- This will store transportation and service information

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for metadata queries
CREATE INDEX IF NOT EXISTS idx_bookings_metadata ON bookings USING GIN (metadata);

-- Add comment
COMMENT ON COLUMN bookings.metadata IS 'JSONB field for storing additional booking information like transportation details and service IDs';

