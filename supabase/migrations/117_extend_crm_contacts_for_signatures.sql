-- Migration 117: Extend CRM Contacts for Signature Management
-- Created: 2026-01-09
-- Purpose: Add signature-related fields and expand contact types to support contact management module

-- =====================================================
-- PART 1: EXPAND CONTACT TYPES
-- =====================================================

-- Drop existing constraint
ALTER TABLE crm_contacts 
DROP CONSTRAINT IF EXISTS crm_contacts_contact_type_check;

-- Add expanded contact types from Contact Management Module
ALTER TABLE crm_contacts
ADD CONSTRAINT crm_contacts_contact_type_check 
CHECK (contact_type IN (
  'warehouse_supplier',
  'customer_lead',
  'CUSTOMER',
  'SUPPLIER',
  'WAREHOUSE_OWNER',
  'RESELLER',
  'WAREHOUSE_FINDER',
  'PARTNER',
  'EMPLOYEE',
  'OTHER'
));

-- Update comment
COMMENT ON COLUMN crm_contacts.contact_type IS 'Contact type: warehouse_supplier, customer_lead (CRM), or CUSTOMER, SUPPLIER, WAREHOUSE_OWNER, RESELLER, WAREHOUSE_FINDER, PARTNER, EMPLOYEE, OTHER (Contact Management)';

-- =====================================================
-- PART 2: ADD SIGNATURE-RELATED FIELDS
-- =====================================================

-- Add fields for signature tracking
ALTER TABLE crm_contacts
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Update contact_name to be computed from first_name + last_name if needed
-- For backward compatibility, keep contact_name as is, but add first_name/last_name

-- Add index for signature-related queries
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_last_modified_by ON crm_contacts(last_modified_by) WHERE last_modified_by IS NOT NULL;

-- =====================================================
-- PART 3: UPDATE RLS POLICIES
-- =====================================================

-- Ensure RLS is enabled
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;

-- Add policy for signature-related updates (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'crm_contacts' 
    AND policyname = 'Users can update contacts for signatures'
  ) THEN
    CREATE POLICY "Users can update contacts for signatures" ON crm_contacts
      FOR UPDATE
      USING (
        auth.uid() = created_by 
        OR auth.uid() = assigned_to 
        OR auth.uid() = last_modified_by
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role IN ('root', 'warehouse_admin', 'company_admin')
        )
      );
  END IF;
END $$;

-- =====================================================
-- PART 4: ADD COMMENTS
-- =====================================================

COMMENT ON COLUMN crm_contacts.first_name IS 'First name for contact (used with last_name for full name)';
COMMENT ON COLUMN crm_contacts.last_name IS 'Last name for contact (used with first_name for full name)';
COMMENT ON COLUMN crm_contacts.notes IS 'Additional notes about the contact';
COMMENT ON COLUMN crm_contacts.last_modified_by IS 'User who last modified this contact record';

