-- Migration: Add client_type to profiles and billing_type to companies
-- Created: 2026-01-29
-- Purpose: Support individual and corporate client types with billing preferences
--
-- This migration:
-- 1. Adds client_type column to profiles table (individual/corporate)
-- 2. Adds billing_type column to companies table (company/individual/hybrid)
-- 3. Updates existing users with company_id to be corporate clients

-- =====================================================
-- PART 1: ADD CLIENT_TYPE TO PROFILES
-- =====================================================

-- Add client_type column with default 'individual'
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'individual';

-- Add constraint for client_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_client_type_check'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_client_type_check 
    CHECK (client_type IN ('individual', 'corporate'));
  END IF;
END $$;

-- Update existing users with company_id to be corporate clients
UPDATE profiles 
SET client_type = 'corporate' 
WHERE company_id IS NOT NULL AND client_type = 'individual';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_client_type ON profiles(client_type);

-- Add comment
COMMENT ON COLUMN profiles.client_type IS 'Client type: individual (like Airbnb user) or corporate (with company and teams)';

-- =====================================================
-- PART 2: ADD BILLING_TYPE TO COMPANIES
-- =====================================================

-- Add billing_type column with default 'individual'
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'individual';

-- Add constraint for billing_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'companies_billing_type_check'
  ) THEN
    ALTER TABLE companies
    ADD CONSTRAINT companies_billing_type_check 
    CHECK (billing_type IN ('company', 'individual', 'hybrid'));
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_billing_type ON companies(billing_type);

-- Add comment
COMMENT ON COLUMN companies.billing_type IS 'Billing type: company (all invoices to company), individual (each user pays own), hybrid (both options)';

-- =====================================================
-- PART 3: UPDATE HANDLE_NEW_USER FUNCTION
-- =====================================================

-- Update the handle_new_user function to set client_type
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, client_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'warehouse_client'),
    COALESCE(NEW.raw_user_meta_data->>'client_type', 'individual')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, profiles.name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

