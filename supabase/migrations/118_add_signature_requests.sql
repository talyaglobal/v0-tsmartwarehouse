-- Migration 118: Add Signature Requests Table
-- Created: 2026-01-09
-- Purpose: Create signature_requests table for KolaySign integration
-- Links to crm_contacts instead of separate contacts table

-- =====================================================
-- CREATE SIGNATURE_REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relations
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Document Information
  document_id VARCHAR(255) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_url TEXT NOT NULL,
  
  -- Signature Status
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING', 'SIGNED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  
  -- KolaySign Integration
  signing_url TEXT,
  signed_document_url TEXT,
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  kolaysign_request_id VARCHAR(255),
  kolaysign_document_id VARCHAR(255),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_signature_requests_contact_id ON signature_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_signature_requests_created_by ON signature_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_signature_requests_kolaysign_id ON signature_requests(kolaysign_request_id) WHERE kolaysign_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signature_requests_expires_at ON signature_requests(expires_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_signature_requests_document_id ON signature_requests(document_id);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Users can view signature requests for their contacts
CREATE POLICY "Users can view signature requests for their contacts" ON signature_requests
  FOR SELECT USING (
    contact_id IN (
      SELECT id FROM crm_contacts 
      WHERE created_by = auth.uid() 
      OR assigned_to = auth.uid()
    )
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin', 'company_admin')
    )
  );

-- Users can create signature requests
CREATE POLICY "Users can create signature requests" ON signature_requests
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND contact_id IN (
      SELECT id FROM crm_contacts 
      WHERE created_by = auth.uid() 
      OR assigned_to = auth.uid()
    )
  );

-- Users can update signature requests
CREATE POLICY "Users can update signature requests" ON signature_requests
  FOR UPDATE USING (
    contact_id IN (
      SELECT id FROM crm_contacts 
      WHERE created_by = auth.uid() 
      OR assigned_to = auth.uid()
    )
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin', 'company_admin')
    )
  );

-- Users can delete signature requests
CREATE POLICY "Users can delete signature requests" ON signature_requests
  FOR DELETE USING (
    contact_id IN (
      SELECT id FROM crm_contacts 
      WHERE created_by = auth.uid() 
      OR assigned_to = auth.uid()
    )
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin', 'company_admin')
    )
  );

-- =====================================================
-- CREATE TRIGGER FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_signature_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_signature_requests_updated_at ON signature_requests;

CREATE TRIGGER trigger_update_signature_requests_updated_at
  BEFORE UPDATE ON signature_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_signature_requests_updated_at();

-- =====================================================
-- ADD COMMENTS
-- =====================================================

COMMENT ON TABLE signature_requests IS 'Tracks digital signature requests via KolaySign for contacts';
COMMENT ON COLUMN signature_requests.contact_id IS 'Reference to crm_contacts table';
COMMENT ON COLUMN signature_requests.status IS 'Signature status: PENDING, SIGNED, REJECTED, EXPIRED, CANCELLED';
COMMENT ON COLUMN signature_requests.kolaysign_request_id IS 'KolaySign API request ID';
COMMENT ON COLUMN signature_requests.kolaysign_document_id IS 'KolaySign API document ID';

