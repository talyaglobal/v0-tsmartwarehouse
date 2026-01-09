-- Migration 119: Add Agreement Tracking System
-- Created: 2026-01-09
-- Purpose: Create comprehensive agreement tracking for all legal documents
-- Supports 20+ agreement types with versioning

-- =====================================================
-- PART 1: AGREEMENT VERSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS agreement_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Agreement Identification
  agreement_type VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL, -- Format: MAJOR.MINOR (e.g., "1.0", "1.1", "2.0")
  
  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown content
  pdf_url TEXT, -- URL to generated PDF in storage
  
  -- Metadata
  is_major_version BOOLEAN DEFAULT false, -- Major versions require re-acceptance
  effective_date DATE NOT NULL,
  expiry_date DATE, -- Optional expiry date
  
  -- Language Support (future)
  language VARCHAR(10) DEFAULT 'en',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_draft BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(agreement_type, version, language)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agreement_versions_type ON agreement_versions(agreement_type);
CREATE INDEX IF NOT EXISTS idx_agreement_versions_active ON agreement_versions(agreement_type, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_agreement_versions_effective_date ON agreement_versions(effective_date);

-- =====================================================
-- PART 2: USER AGREEMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS user_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relations
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agreement_version_id UUID NOT NULL REFERENCES agreement_versions(id) ON DELETE RESTRICT,
  
  -- Acceptance Details
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_ip INET,
  accepted_user_agent TEXT,
  acceptance_method VARCHAR(50) DEFAULT 'web', -- 'web', 'mobile_app', 'api'
  
  -- Signature (typed name or digital signature)
  signature_text TEXT, -- Typed name
  signature_method VARCHAR(50) DEFAULT 'typed', -- 'typed', 'kolaysign', 'eid'
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, agreement_version_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_agreements_user_id ON user_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_agreements_version_id ON user_agreements(agreement_version_id);
CREATE INDEX IF NOT EXISTS idx_user_agreements_type ON user_agreements(user_id, agreement_version_id);

-- =====================================================
-- PART 3: WAREHOUSE AGREEMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS warehouse_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relations
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  agreement_version_id UUID NOT NULL REFERENCES agreement_versions(id) ON DELETE RESTRICT,
  accepted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  
  -- Acceptance Details
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_ip INET,
  accepted_user_agent TEXT,
  
  -- Signature
  signature_text TEXT,
  signature_method VARCHAR(50) DEFAULT 'typed',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(warehouse_id, agreement_version_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_agreements_warehouse_id ON warehouse_agreements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_agreements_version_id ON warehouse_agreements(agreement_version_id);

-- =====================================================
-- PART 4: BOOKING AGREEMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS booking_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relations
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  agreement_version_id UUID NOT NULL REFERENCES agreement_versions(id) ON DELETE RESTRICT,
  accepted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  
  -- Acceptance Details
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_ip INET,
  accepted_user_agent TEXT,
  
  -- Signature
  signature_text TEXT,
  signature_method VARCHAR(50) DEFAULT 'typed',
  
  -- Booking-specific metadata
  metadata JSONB DEFAULT '{}', -- Store booking-specific terms
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(booking_id, agreement_version_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_booking_agreements_booking_id ON booking_agreements(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_agreements_version_id ON booking_agreements(agreement_version_id);

-- =====================================================
-- PART 5: UPDATE EXISTING TABLES
-- =====================================================

-- Add agreements_accepted JSONB to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS agreements_accepted JSONB DEFAULT '{}'::jsonb;

-- Structure: {
--   "tos": {"version": "1.0", "accepted_at": "2026-01-09T10:00:00Z", "ip": "192.168.1.1"},
--   "privacy_policy": {"version": "1.0", "accepted_at": "2026-01-09T10:00:00Z"},
--   ...
-- }

-- Add owner_agreements JSONB to warehouses
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS owner_agreements JSONB DEFAULT '{}'::jsonb;

-- Structure: {
--   "service_agreement": {"version": "1.0", "accepted_at": "2026-01-09T10:00:00Z"},
--   "sla": {"tier": "gold", "version": "1.0", "accepted_at": "2026-01-09T10:00:00Z"},
--   ...
-- }

-- Add booking_agreements JSONB to bookings
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS booking_agreements JSONB DEFAULT '{}'::jsonb;

-- Structure: {
--   "customer_agreement": {"version": "1.0", "accepted_at": "2026-01-09T10:00:00Z"},
--   "cancellation_policy": {"type": "moderate", "accepted_at": "2026-01-09T10:00:00Z"},
--   ...
-- }

-- Add indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_profiles_agreements_accepted ON profiles USING GIN(agreements_accepted);
CREATE INDEX IF NOT EXISTS idx_warehouses_owner_agreements ON warehouses USING GIN(owner_agreements);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_agreements ON bookings USING GIN(booking_agreements);

-- =====================================================
-- PART 6: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE agreement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_agreements ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 7: CREATE RLS POLICIES
-- =====================================================

-- Agreement Versions: Public read, admin write
CREATE POLICY "Anyone can view active agreement versions" ON agreement_versions
  FOR SELECT USING (is_active = true AND is_draft = false);

CREATE POLICY "Admins can manage agreement versions" ON agreement_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin')
    )
  );

-- User Agreements: Users can view their own, admins can view all
CREATE POLICY "Users can view their own agreements" ON user_agreements
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin', 'company_admin')
    )
  );

CREATE POLICY "Users can create their own agreements" ON user_agreements
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Warehouse Agreements: Warehouse owners and admins
CREATE POLICY "Users can view warehouse agreements" ON warehouse_agreements
  FOR SELECT USING (
    warehouse_id IN (
      SELECT id FROM warehouses 
      WHERE owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin')
    )
  );

CREATE POLICY "Warehouse owners can create agreements" ON warehouse_agreements
  FOR INSERT WITH CHECK (
    warehouse_id IN (
      SELECT id FROM warehouses 
      WHERE owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND accepted_by = auth.uid()
  );

-- Booking Agreements: Booking participants and admins
CREATE POLICY "Users can view booking agreements" ON booking_agreements
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM bookings 
      WHERE customer_id = auth.uid()
      OR warehouse_id IN (
        SELECT id FROM warehouses 
        WHERE owner_company_id IN (
          SELECT company_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin', 'company_admin')
    )
  );

CREATE POLICY "Users can create booking agreements" ON booking_agreements
  FOR INSERT WITH CHECK (
    booking_id IN (
      SELECT id FROM bookings 
      WHERE customer_id = auth.uid()
    )
    AND accepted_by = auth.uid()
  );

-- =====================================================
-- PART 8: CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to get latest agreement version
CREATE OR REPLACE FUNCTION get_latest_agreement_version(
  p_agreement_type VARCHAR,
  p_language VARCHAR DEFAULT 'en'
)
RETURNS TABLE (
  id UUID,
  agreement_type VARCHAR,
  version VARCHAR,
  title TEXT,
  content TEXT,
  pdf_url TEXT,
  is_major_version BOOLEAN,
  effective_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    av.id,
    av.agreement_type,
    av.version,
    av.title,
    av.content,
    av.pdf_url,
    av.is_major_version,
    av.effective_date
  FROM agreement_versions av
  WHERE av.agreement_type = p_agreement_type
    AND av.language = p_language
    AND av.is_active = true
    AND av.is_draft = false
    AND (av.expiry_date IS NULL OR av.expiry_date >= CURRENT_DATE)
  ORDER BY 
    -- Sort by version number (major.minor)
    (string_to_array(av.version, '.'))[1]::INTEGER DESC,
    (string_to_array(av.version, '.'))[2]::INTEGER DESC NULLS LAST
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has accepted agreement
CREATE OR REPLACE FUNCTION has_user_accepted_agreement(
  p_user_id UUID,
  p_agreement_type VARCHAR,
  p_min_version VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_accepted BOOLEAN := false;
  v_latest_version RECORD;
BEGIN
  -- Get latest version
  SELECT * INTO v_latest_version
  FROM get_latest_agreement_version(p_agreement_type);
  
  IF v_latest_version IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has accepted this version or newer
  SELECT EXISTS(
    SELECT 1 
    FROM user_agreements ua
    JOIN agreement_versions av ON ua.agreement_version_id = av.id
    WHERE ua.user_id = p_user_id
      AND av.agreement_type = p_agreement_type
      AND (
        p_min_version IS NULL 
        OR (
          (string_to_array(av.version, '.'))[1]::INTEGER >= (string_to_array(p_min_version, '.'))[1]::INTEGER
          AND (
            (string_to_array(av.version, '.'))[1]::INTEGER > (string_to_array(p_min_version, '.'))[1]::INTEGER
            OR (string_to_array(av.version, '.'))[2]::INTEGER >= COALESCE((string_to_array(p_min_version, '.'))[2]::INTEGER, 0)
          )
        )
      )
  ) INTO v_has_accepted;
  
  RETURN v_has_accepted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 9: ADD COMMENTS
-- =====================================================

COMMENT ON TABLE agreement_versions IS 'Stores all agreement templates with versioning support';
COMMENT ON TABLE user_agreements IS 'Tracks user-level agreement acceptances (ToS, Privacy, etc.)';
COMMENT ON TABLE warehouse_agreements IS 'Tracks warehouse owner agreement acceptances';
COMMENT ON TABLE booking_agreements IS 'Tracks booking-specific agreement acceptances';

COMMENT ON COLUMN profiles.agreements_accepted IS 'JSONB cache of user agreement acceptances for quick lookup';
COMMENT ON COLUMN warehouses.owner_agreements IS 'JSONB cache of warehouse owner agreement acceptances';
COMMENT ON COLUMN bookings.booking_agreements IS 'JSONB cache of booking-specific agreement acceptances';

