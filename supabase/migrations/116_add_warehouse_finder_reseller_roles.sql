-- Migration 116: Add Warehouse Finder and Reseller Roles + CRM System
-- Created: 2026-01-09
-- Purpose: Add warehouse_finder and reseller roles, create comprehensive CRM system
-- 
-- This migration:
-- 1. Adds warehouse_finder and reseller roles to profiles
-- 2. Creates crm_contacts table for managing contacts/leads
-- 3. Creates crm_activities table for tracking all interactions
-- 4. Creates crm_pipeline_milestones table with pre-populated milestones
-- 5. Creates crm_performance_metrics table for tracking KPIs
-- 6. Sets up RLS policies for all CRM tables
-- 7. Creates PostGIS function for location-based warehouse discovery
-- 8. Creates trigger functions for auto-updates

-- =====================================================
-- PART 1: UPDATE PROFILES TABLE WITH NEW ROLES
-- =====================================================

-- Step 1: Drop existing role constraint
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;
END $$;

-- Step 2: Add new constraint with warehouse_finder and reseller roles
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN (
  'root', 
  'warehouse_owner', 
  'warehouse_admin', 
  'customer', 
  'warehouse_staff',
  'warehouse_finder',
  'reseller'
));

-- Step 3: Update role column comment
COMMENT ON COLUMN profiles.role IS 'User role: root (System Admin), warehouse_owner (Warehouse Owner), warehouse_admin (Warehouse Admin), customer (Customer/Member), warehouse_staff (Warehouse Staff), warehouse_finder (Warehouse Scout/BD), reseller (Customer Acquisition/BD)';

-- Step 4: Create indexes for new roles
CREATE INDEX IF NOT EXISTS idx_profiles_warehouse_finder ON profiles(role) WHERE role = 'warehouse_finder';
CREATE INDEX IF NOT EXISTS idx_profiles_reseller ON profiles(role) WHERE role = 'reseller';

-- =====================================================
-- PART 2: CRM CONTACTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Contact Type
  contact_type TEXT NOT NULL CHECK (contact_type IN ('warehouse_supplier', 'customer_lead')),
  
  -- Basic Information
  contact_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  secondary_phone TEXT,
  
  -- Location (for warehouse suppliers)
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Turkey',
  postal_code TEXT,
  location GEOGRAPHY(POINT, 4326), -- PostGIS for location-based search
  
  -- Warehouse Details (for warehouse_supplier type)
  warehouse_size_sqm DECIMAL(10, 2),
  warehouse_type TEXT[], -- ['cold_storage', 'dry_storage', 'hazmat', etc.]
  available_services TEXT[], -- ['loading', 'packaging', 'inventory_management', etc.]
  estimated_capacity INTEGER,
  current_utilization_percent INTEGER,
  
  -- Customer Details (for customer_lead type)
  industry TEXT,
  company_size TEXT CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  estimated_space_need_sqm DECIMAL(10, 2),
  budget_range TEXT,
  decision_maker_name TEXT,
  decision_maker_title TEXT,
  
  -- Pipeline Stage (0-100%)
  pipeline_stage INTEGER NOT NULL DEFAULT 10 CHECK (pipeline_stage >= 0 AND pipeline_stage <= 100),
  pipeline_milestone TEXT NOT NULL DEFAULT 'contact_created',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'approved', 'rejected', 'converted', 'inactive', 'archived')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Admin Approval
  requires_approval BOOLEAN DEFAULT false,
  approval_requested_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  -- Conversion Tracking
  converted_to_warehouse_id UUID REFERENCES warehouses(id),
  converted_to_customer_id UUID REFERENCES profiles(id),
  first_transaction_date TIMESTAMPTZ,
  first_transaction_amount DECIMAL(10, 2),
  
  -- Metadata
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_contact_date TIMESTAMPTZ,
  next_follow_up_date TIMESTAMPTZ
);

-- Indexes for crm_contacts
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_by ON crm_contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned_to ON crm_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company_id ON crm_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_contact_type ON crm_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_pipeline_stage ON crm_contacts(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_location ON crm_contacts USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_next_follow_up ON crm_contacts(next_follow_up_date) WHERE status = 'active';

-- =====================================================
-- PART 3: CRM ACTIVITIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relations
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Activity Details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'visit', 'call', 'email', 'meeting', 'note', 'task', 'proposal_sent', 'contract_sent', 'follow_up'
  )),
  
  -- Content
  subject TEXT NOT NULL,
  description TEXT,
  outcome TEXT, -- 'successful', 'needs_follow_up', 'not_interested', 'callback_requested'
  
  -- Visit Specific (for warehouse_finder)
  visit_date TIMESTAMPTZ,
  visit_location TEXT,
  visit_duration_minutes INTEGER,
  visit_notes TEXT,
  visit_photos TEXT[], -- URLs to uploaded photos
  property_condition TEXT, -- 'excellent', 'good', 'fair', 'poor'
  owner_interest_level TEXT, -- 'very_interested', 'interested', 'neutral', 'not_interested'
  
  -- Call/Email Specific
  call_duration_minutes INTEGER,
  call_recording_url TEXT,
  email_sent_at TIMESTAMPTZ,
  email_opened BOOLEAN DEFAULT false,
  email_clicked BOOLEAN DEFAULT false,
  
  -- Task Management
  is_task BOOLEAN DEFAULT false,
  task_due_date TIMESTAMPTZ,
  task_completed BOOLEAN DEFAULT false,
  task_completed_at TIMESTAMPTZ,
  
  -- Pipeline Impact
  moved_to_stage INTEGER, -- New pipeline stage after this activity
  stage_change_reason TEXT,
  
  -- Metadata
  attachments JSONB DEFAULT '[]',
  tags TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for crm_activities
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_by ON crm_activities(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_activities_activity_type ON crm_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_crm_activities_visit_date ON crm_activities(visit_date) WHERE activity_type = 'visit';
CREATE INDEX IF NOT EXISTS idx_crm_activities_tasks ON crm_activities(task_due_date) WHERE is_task = true AND task_completed = false;

-- =====================================================
-- PART 4: CRM PIPELINE MILESTONES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_pipeline_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Pipeline Configuration
  pipeline_type TEXT NOT NULL CHECK (pipeline_type IN ('warehouse_supplier', 'customer_lead')),
  
  -- Milestone Details
  stage_number INTEGER NOT NULL CHECK (stage_number >= 1 AND stage_number <= 10),
  stage_percentage INTEGER NOT NULL CHECK (stage_percentage >= 10 AND stage_percentage <= 100),
  milestone_name TEXT NOT NULL,
  milestone_description TEXT,
  
  -- Requirements
  required_activities TEXT[], -- Activities needed to reach this stage
  typical_duration_days INTEGER, -- Average time to complete this stage
  
  -- Automation
  auto_advance_conditions JSONB, -- Conditions to automatically advance
  notification_template TEXT, -- Notification to send when reached
  
  -- Display
  icon TEXT,
  color TEXT,
  display_order INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(pipeline_type, stage_number)
);

-- Insert default milestones for Warehouse Finder
INSERT INTO crm_pipeline_milestones (pipeline_type, stage_number, stage_percentage, milestone_name, milestone_description, required_activities) VALUES
-- Warehouse Supplier Pipeline
('warehouse_supplier', 1, 10, 'Contact Created', 'Initial warehouse contact added to CRM', ARRAY['note']),
('warehouse_supplier', 2, 20, 'First Contact Made', 'Initial call or email sent to warehouse owner', ARRAY['call', 'email']),
('warehouse_supplier', 3, 30, 'Interest Confirmed', 'Warehouse owner shows interest in joining platform', ARRAY['call', 'meeting']),
('warehouse_supplier', 4, 40, 'Site Visit Scheduled', 'Physical warehouse visit appointment scheduled', ARRAY['meeting']),
('warehouse_supplier', 5, 50, 'Site Visit Completed', 'Warehouse inspection and documentation completed', ARRAY['visit']),
('warehouse_supplier', 6, 60, 'Admin Approval Requested', 'Submitted warehouse details for admin review', ARRAY['note']),
('warehouse_supplier', 7, 70, 'Admin Approved', 'Admin approved warehouse for onboarding', ARRAY['note']),
('warehouse_supplier', 8, 80, 'Contract Negotiation', 'Terms and pricing being negotiated', ARRAY['meeting', 'proposal_sent']),
('warehouse_supplier', 9, 90, 'Contract Signed', 'Warehouse owner signed partnership agreement', ARRAY['contract_sent']),
('warehouse_supplier', 10, 100, 'First Reservation', 'First customer booking received for this warehouse', ARRAY['note']),

-- Customer Lead Pipeline
('customer_lead', 1, 10, 'Lead Created', 'Potential customer added to CRM', ARRAY['note']),
('customer_lead', 2, 20, 'First Outreach', 'Initial contact attempt made', ARRAY['call', 'email']),
('customer_lead', 3, 30, 'Contact Established', 'Customer responded and showed interest', ARRAY['call', 'email']),
('customer_lead', 4, 40, 'Needs Assessment', 'Understanding customer requirements', ARRAY['meeting', 'call']),
('customer_lead', 5, 50, 'Demo/Presentation', 'Platform demo or presentation completed', ARRAY['meeting']),
('customer_lead', 6, 60, 'Proposal Sent', 'Custom proposal or quote sent to customer', ARRAY['proposal_sent']),
('customer_lead', 7, 70, 'Negotiation', 'Discussing terms, pricing, and requirements', ARRAY['meeting', 'call']),
('customer_lead', 8, 80, 'Decision Stage', 'Customer evaluating final decision', ARRAY['follow_up']),
('customer_lead', 9, 90, 'Commitment', 'Customer committed to using platform', ARRAY['contract_sent']),
('customer_lead', 10, 100, 'First Purchase', 'Customer made first warehouse booking/purchase', ARRAY['note'])
ON CONFLICT (pipeline_type, stage_number) DO NOTHING;

-- Indexes for crm_pipeline_milestones
CREATE INDEX IF NOT EXISTS idx_pipeline_milestones_type ON crm_pipeline_milestones(pipeline_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_milestones_stage ON crm_pipeline_milestones(stage_number);

-- =====================================================
-- PART 5: CRM PERFORMANCE METRICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Time Period
  metric_date DATE NOT NULL,
  metric_month DATE NOT NULL, -- First day of month
  metric_quarter TEXT NOT NULL, -- 'Q1-2026'
  metric_year INTEGER NOT NULL,
  
  -- Activity Metrics
  contacts_created INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  visits_conducted INTEGER DEFAULT 0,
  meetings_held INTEGER DEFAULT 0,
  
  -- Pipeline Metrics
  contacts_in_pipeline INTEGER DEFAULT 0,
  contacts_moved_forward INTEGER DEFAULT 0,
  contacts_moved_backward INTEGER DEFAULT 0,
  contacts_converted INTEGER DEFAULT 0,
  average_pipeline_stage DECIMAL(5, 2),
  
  -- Conversion Metrics
  conversion_rate DECIMAL(5, 2), -- Percentage
  average_days_to_convert DECIMAL(10, 2),
  total_revenue_generated DECIMAL(12, 2),
  
  -- Quality Metrics
  admin_approvals_requested INTEGER DEFAULT 0,
  admin_approvals_granted INTEGER DEFAULT 0,
  admin_approval_rate DECIMAL(5, 2),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, metric_date)
);

-- Indexes for crm_performance_metrics
CREATE INDEX IF NOT EXISTS idx_crm_metrics_user_id ON crm_performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_metrics_date ON crm_performance_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_crm_metrics_month ON crm_performance_metrics(metric_month);

-- =====================================================
-- PART 6: ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all CRM tables
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_contacts

-- Users can view their own contacts
CREATE POLICY "Users can view own contacts"
ON crm_contacts FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Users can create contacts
CREATE POLICY "Users can create contacts"
ON crm_contacts FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('warehouse_finder', 'reseller', 'root', 'warehouse_admin')
  )
);

-- Users can update their own contacts
CREATE POLICY "Users can update own contacts"
ON crm_contacts FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Admins can view all contacts in their company
CREATE POLICY "Admins can view company contacts"
ON crm_contacts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('root', 'warehouse_admin', 'warehouse_owner')
    AND company_id = crm_contacts.company_id
  )
);

-- Root can view all contacts
CREATE POLICY "Root can view all contacts"
ON crm_contacts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'root'
  )
);

-- RLS Policies for crm_activities

-- Users can view activities for their own contacts
CREATE POLICY "Users can view own contact activities"
ON crm_activities FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM crm_contacts
    WHERE crm_contacts.id = crm_activities.contact_id
    AND crm_contacts.created_by = auth.uid()
  )
);

-- Users can create activities for their own contacts
CREATE POLICY "Users can create activities for own contacts"
ON crm_activities FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM crm_contacts
    WHERE crm_contacts.id = crm_activities.contact_id
    AND crm_contacts.created_by = auth.uid()
  )
);

-- Users can update their own activities
CREATE POLICY "Users can update own activities"
ON crm_activities FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Admins can view all activities in their company
CREATE POLICY "Admins can view company activities"
ON crm_activities FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('root', 'warehouse_admin', 'warehouse_owner')
    AND company_id = crm_activities.company_id
  )
);

-- RLS Policies for crm_performance_metrics

-- Users can view their own metrics
CREATE POLICY "Users can view own metrics"
ON crm_performance_metrics FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view metrics for their company
CREATE POLICY "Admins can view company metrics"
ON crm_performance_metrics FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('root', 'warehouse_admin', 'warehouse_owner')
    AND company_id = crm_performance_metrics.company_id
  )
);

-- =====================================================
-- PART 7: DATABASE FUNCTIONS
-- =====================================================

-- Function to find warehouses near a location (PostGIS)
CREATE OR REPLACE FUNCTION find_warehouses_near_location(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  total_sq_ft INTEGER,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.address,
    w.city,
    w.latitude,
    w.longitude,
    w.total_sq_ft,
    ST_Distance(
      w.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) / 1000.0 AS distance_km
  FROM warehouses w
  WHERE w.location IS NOT NULL
    AND ST_DWithin(
      w.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- Function to update last_contact_date when activity is created
CREATE OR REPLACE FUNCTION update_last_contact_date()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE crm_contacts
  SET last_contact_date = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_contact_date
DROP TRIGGER IF EXISTS trigger_update_last_contact_date ON crm_activities;
CREATE TRIGGER trigger_update_last_contact_date
AFTER INSERT ON crm_activities
FOR EACH ROW
EXECUTE FUNCTION update_last_contact_date();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_crm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_update_crm_contacts_updated_at ON crm_contacts;
CREATE TRIGGER trigger_update_crm_contacts_updated_at
BEFORE UPDATE ON crm_contacts
FOR EACH ROW
EXECUTE FUNCTION update_crm_updated_at();

DROP TRIGGER IF EXISTS trigger_update_crm_activities_updated_at ON crm_activities;
CREATE TRIGGER trigger_update_crm_activities_updated_at
BEFORE UPDATE ON crm_activities
FOR EACH ROW
EXECUTE FUNCTION update_crm_updated_at();

DROP TRIGGER IF EXISTS trigger_update_crm_metrics_updated_at ON crm_performance_metrics;
CREATE TRIGGER trigger_update_crm_metrics_updated_at
BEFORE UPDATE ON crm_performance_metrics
FOR EACH ROW
EXECUTE FUNCTION update_crm_updated_at();

-- Function to auto-update location when address fields change
CREATE OR REPLACE FUNCTION update_crm_contact_location()
RETURNS TRIGGER AS $$
BEGIN
  -- This function can be extended to geocode addresses
  -- For now, location should be set via API when lat/lng are provided
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE crm_contacts IS 'CRM contacts for warehouse finders (warehouse_supplier) and resellers (customer_lead)';
COMMENT ON TABLE crm_activities IS 'All activities tracked for CRM contacts (visits, calls, emails, meetings, etc.)';
COMMENT ON TABLE crm_pipeline_milestones IS 'Pipeline milestone definitions for both warehouse supplier and customer lead pipelines';
COMMENT ON TABLE crm_performance_metrics IS 'Performance metrics aggregated by day/month/quarter/year for warehouse finders and resellers';

