-- Create companies table
-- This table stores company information

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Create policies
-- All authenticated users can view companies
CREATE POLICY "Users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

-- Users can create companies
CREATE POLICY "Users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update companies (for now, all users can update - can be restricted later)
CREATE POLICY "Users can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS companies_name_idx ON companies(name);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_companies_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_companies_updated_at_column();

