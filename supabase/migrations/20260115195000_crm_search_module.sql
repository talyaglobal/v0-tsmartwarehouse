-- CRM Search Module schema (SerpAPI)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'search_job_status') THEN
    CREATE TYPE search_job_status AS ENUM ('draft', 'queued', 'running', 'done', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'search_result_status') THEN
    CREATE TYPE search_result_status AS ENUM ('new', 'reviewed', 'approved', 'rejected', 'merged');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'segment_type') THEN
    CREATE TYPE segment_type AS ENUM (
      'warehouse_space_owner',
      'warehouse_space_seeker',
      '3pl_operator',
      'customs_broker',
      'freight_forwarder_international',
      'drayage_trucking_local',
      'warehouse_staffing_jobs',
      'warehouse_job_seekers',
      'equipment_vendor',
      'fmcg_distributor',
      'warehouse_real_estate_broker',
      'bonded_warehouse_antrepo',
      'customs_cbp_facility_directory'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_type') THEN
    CREATE TYPE opportunity_type AS ENUM ('space_available', 'space_needed', 'services_partner', 'hiring_signal');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_status') THEN
    CREATE TYPE consent_status AS ENUM ('unknown', 'pending', 'opted_in', 'opted_out');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'suppression_type') THEN
    CREATE TYPE suppression_type AS ENUM ('email', 'domain', 'phone');
  END IF;
END $$;

-- =============================================================================
-- CRM SEARCH TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_search_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  status search_job_status NOT NULL DEFAULT 'draft',
  segments segment_type[] NOT NULL,
  geo_json JSONB NOT NULL DEFAULT '{}',
  serpapi_params_json JSONB DEFAULT '{}',
  exclusions_json JSONB DEFAULT '{"domains": [], "keywords": []}',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  total_queries INTEGER DEFAULT 0,
  total_results INTEGER DEFAULT 0,
  created_leads INTEGER DEFAULT 0,
  api_credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES crm_search_jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  serpapi_location TEXT,
  serpapi_params_json JSONB DEFAULT '{}',
  serpapi_search_id TEXT,
  executed_at TIMESTAMPTZ,
  results_count INTEGER DEFAULT 0,
  from_cache BOOLEAN DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES crm_search_jobs(id) ON DELETE CASCADE,
  query_id UUID NOT NULL REFERENCES crm_search_queries(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  snippet TEXT,
  url TEXT NOT NULL,
  displayed_link TEXT,
  domain TEXT NOT NULL,
  position INTEGER,
  result_date TEXT,
  cache_hash TEXT,
  classification_segment segment_type,
  classification_confidence DECIMAL(3,2) DEFAULT 0,
  extracted_emails TEXT[] DEFAULT '{}',
  extracted_phones TEXT[] DEFAULT '{}',
  extracted_address_text TEXT,
  contact_confidence DECIMAL(3,2) DEFAULT 0,
  score INTEGER DEFAULT 0,
  score_breakdown_json JSONB DEFAULT '{}',
  dedupe_key TEXT,
  status search_result_status NOT NULL DEFAULT 'new',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_account_id UUID,
  created_lead_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CRM CORE TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  segments segment_type[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  hq_address TEXT,
  hq_city TEXT,
  hq_state TEXT,
  hq_zip TEXT,
  hq_country TEXT DEFAULT 'US',
  score INTEGER DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  needs_verification BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  consent_status consent_status DEFAULT 'unknown',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  company_name TEXT,
  segments segment_type[] DEFAULT '{}',
  score INTEGER DEFAULT 0,
  score_breakdown_json JSONB DEFAULT '{}',
  stage TEXT DEFAULT 'new',
  source TEXT DEFAULT 'serpapi',
  source_job_id UUID REFERENCES crm_search_jobs(id),
  converted_to_account_id UUID REFERENCES crm_accounts(id),
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id UUID REFERENCES crm_accounts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id),
  name TEXT NOT NULL,
  type opportunity_type NOT NULL,
  stage TEXT DEFAULT 'new',
  estimated_value DECIMAL(12,2),
  space_sqft INTEGER,
  location_preference TEXT,
  close_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id UUID REFERENCES crm_accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- COMPLIANCE TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type suppression_type NOT NULL,
  value TEXT NOT NULL,
  reason TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(company_id, type, value)
);

CREATE TABLE IF NOT EXISTS crm_source_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  source_url TEXT NOT NULL,
  source_query TEXT,
  source_title TEXT,
  source_snippet TEXT,
  serpapi_search_id TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_search_jobs_company_status ON crm_search_jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_search_results_job_id ON crm_search_results(job_id);
CREATE INDEX IF NOT EXISTS idx_search_results_company_domain ON crm_search_results(company_id, domain);
CREATE INDEX IF NOT EXISTS idx_search_results_dedupe ON crm_search_results(company_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_accounts_company_domain ON crm_accounts(company_id, domain);
CREATE INDEX IF NOT EXISTS idx_leads_company_domain ON crm_leads(company_id, domain);
CREATE INDEX IF NOT EXISTS idx_suppression_company_type ON crm_suppression_list(company_id, type);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE crm_search_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_source_log ENABLE ROW LEVEL SECURITY;

-- Company isolation via profiles.company_id
CREATE POLICY "company_isolation" ON crm_search_jobs
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "company_isolation" ON crm_search_queries
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "company_isolation" ON crm_search_results
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "company_isolation" ON crm_accounts
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "company_isolation" ON crm_contacts
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "company_isolation" ON crm_leads
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "company_isolation" ON crm_opportunities
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "company_isolation" ON crm_activities
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "company_isolation" ON crm_suppression_list
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "company_isolation" ON crm_source_log
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_crm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_search_jobs_updated_at BEFORE UPDATE ON crm_search_jobs
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON crm_accounts
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON crm_activities
  FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();
