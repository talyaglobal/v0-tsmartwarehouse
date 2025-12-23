-- Add additional fields to companies table
-- Add vat, address, postalcode, city, and country columns

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS vat TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS companies_vat_idx ON companies(vat);
CREATE INDEX IF NOT EXISTS companies_city_idx ON companies(city);
CREATE INDEX IF NOT EXISTS companies_country_idx ON companies(country);

