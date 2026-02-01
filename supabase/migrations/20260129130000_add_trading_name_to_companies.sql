-- Migration: Add trading_name and rename name to short_name in companies table
-- Created: 2026-01-29
-- Purpose: Support both trading name (legal name) and short name for companies

-- Step 1: Add trading_name column
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS trading_name TEXT;

-- Step 2: Rename name column to short_name
ALTER TABLE companies 
RENAME COLUMN name TO short_name;

-- Step 3: Copy existing short_name values to trading_name where trading_name is null
UPDATE companies 
SET trading_name = short_name 
WHERE trading_name IS NULL;

-- Step 4: Drop the old index on name
DROP INDEX IF EXISTS companies_name_idx;

-- Step 5: Create new indexes
CREATE INDEX IF NOT EXISTS companies_short_name_idx ON companies(short_name);
CREATE INDEX IF NOT EXISTS companies_trading_name_idx ON companies(trading_name);

-- Step 6: Add comments for documentation
COMMENT ON COLUMN companies.short_name IS 'Short display name of the company (e.g., "Acme Corp")';
COMMENT ON COLUMN companies.trading_name IS 'Full legal/trading name of the company (e.g., "Acme Corporation Inc.")';
