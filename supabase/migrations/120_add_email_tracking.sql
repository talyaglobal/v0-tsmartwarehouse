-- Email Tracking System for CRM
-- Migration: 120_add_email_tracking
-- Description: Adds tables and functions for tracking email communications (opens, clicks, bounces)
-- Created: 2026-01-10

-- =====================================================
-- PART 1: EMAIL CAMPAIGNS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to TEXT,
  
  -- Content
  html_content TEXT NOT NULL,
  text_content TEXT,
  
  -- Template & Variables
  template_id UUID,
  template_variables JSONB DEFAULT '{}'::jsonb,
  
  -- Status & Scheduling
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  
  -- Targeting
  target_type TEXT NOT NULL CHECK (target_type IN ('all_contacts', 'segment', 'individual', 'custom_list')),
  target_segment TEXT, -- warehouse_supplier, customer_lead, etc.
  target_contact_ids UUID[],
  
  -- Tracking & Analytics
  total_recipients INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,
  total_complained INTEGER DEFAULT 0,
  
  -- Rates (calculated)
  delivery_rate DECIMAL(5,2),
  open_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  bounce_rate DECIMAL(5,2),
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE email_campaigns IS 'Email campaigns sent to contacts for marketing or communication';
COMMENT ON COLUMN email_campaigns.target_type IS 'Who this campaign is targeting';
COMMENT ON COLUMN email_campaigns.target_segment IS 'CRM segment or contact type to target';
COMMENT ON COLUMN email_campaigns.template_variables IS 'Variables to merge into email template';

-- Index for queries
CREATE INDEX idx_email_campaigns_created_by ON email_campaigns(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_campaigns_scheduled_at ON email_campaigns(scheduled_at) WHERE deleted_at IS NULL AND status = 'scheduled';

-- =====================================================
-- PART 2: EMAIL MESSAGES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign (if part of campaign)
  campaign_id UUID REFERENCES email_campaigns(id),
  
  -- Activity (if related to CRM activity)
  activity_id UUID REFERENCES crm_activities(id),
  
  -- Contact
  contact_id UUID REFERENCES crm_contacts(id),
  to_email TEXT NOT NULL,
  to_name TEXT,
  
  -- Email Details
  subject TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  reply_to TEXT,
  
  -- Content
  html_content TEXT NOT NULL,
  text_content TEXT,
  
  -- Provider Details
  provider TEXT NOT NULL DEFAULT 'sendgrid' CHECK (provider IN ('sendgrid', 'ses', 'smtp', 'other')),
  provider_message_id TEXT,
  external_id TEXT, -- SendGrid message ID, SES message ID, etc.
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'queued', 'sent', 'delivered', 'bounced', 'deferred', 'blocked', 'failed'
  )),
  
  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Bounce & Failure Details
  bounce_type TEXT, -- soft, hard
  bounce_reason TEXT,
  failure_reason TEXT,
  
  -- Tracking
  opened_at TIMESTAMPTZ, -- First open
  last_opened_at TIMESTAMPTZ, -- Most recent open
  total_opens INTEGER DEFAULT 0,
  unique_opens INTEGER DEFAULT 0,
  
  clicked_at TIMESTAMPTZ, -- First click
  last_clicked_at TIMESTAMPTZ, -- Most recent click
  total_clicks INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  
  -- Engagement
  unsubscribed_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ, -- Marked as spam
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE email_messages IS 'Individual email messages sent to contacts with tracking';
COMMENT ON COLUMN email_messages.provider_message_id IS 'Message ID from email provider for tracking';
COMMENT ON COLUMN email_messages.metadata IS 'Additional tracking data (user agent, IP, etc.)';

-- Indexes
CREATE INDEX idx_email_messages_campaign_id ON email_messages(campaign_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_activity_id ON email_messages(activity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_contact_id ON email_messages(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_to_email ON email_messages(to_email) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_provider_message_id ON email_messages(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX idx_email_messages_status ON email_messages(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_messages_sent_at ON email_messages(sent_at DESC) WHERE deleted_at IS NULL;

-- =====================================================
-- PART 3: EMAIL EVENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Email Message
  message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  
  -- Event Type
  event_type TEXT NOT NULL CHECK (event_type IN (
    'sent', 'delivered', 'opened', 'clicked', 'bounced', 'deferred', 
    'blocked', 'failed', 'unsubscribed', 'complained', 'dropped'
  )),
  
  -- Event Details
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Link Tracking (for click events)
  link_url TEXT,
  link_index INTEGER,
  
  -- User Agent & IP (for opens and clicks)
  user_agent TEXT,
  ip_address INET,
  
  -- Device Info (parsed from user agent)
  device_type TEXT, -- desktop, mobile, tablet, other
  browser TEXT,
  os TEXT,
  
  -- Geolocation (from IP)
  country TEXT,
  region TEXT,
  city TEXT,
  
  -- Bounce Details (for bounce events)
  bounce_type TEXT, -- soft, hard
  bounce_reason TEXT,
  bounce_smtp_id TEXT,
  
  -- Provider Event Data
  provider_event_id TEXT,
  provider_event_data JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE email_events IS 'Individual tracking events for email messages (opens, clicks, bounces, etc.)';
COMMENT ON COLUMN email_events.link_url IS 'URL clicked (for click events)';
COMMENT ON COLUMN email_events.provider_event_data IS 'Raw event data from email provider';

-- Indexes
CREATE INDEX idx_email_events_message_id ON email_events(message_id);
CREATE INDEX idx_email_events_event_type ON email_events(event_type);
CREATE INDEX idx_email_events_timestamp ON email_events(timestamp DESC);
CREATE INDEX idx_email_events_provider_event_id ON email_events(provider_event_id) WHERE provider_event_id IS NOT NULL;

-- =====================================================
-- PART 4: EMAIL LINKS TABLE (for click tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS email_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Original URL
  original_url TEXT NOT NULL,
  
  -- Short/Tracking URL
  tracking_code TEXT NOT NULL UNIQUE,
  short_url TEXT NOT NULL,
  
  -- Campaign (if part of campaign)
  campaign_id UUID REFERENCES email_campaigns(id),
  
  -- Message (if specific to message)
  message_id UUID REFERENCES email_messages(id),
  
  -- Link Position
  link_index INTEGER,
  link_text TEXT,
  
  -- Tracking Stats
  total_clicks INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE email_links IS 'Tracked links in emails for click analytics';
COMMENT ON COLUMN email_links.tracking_code IS 'Unique code for this tracked link';
COMMENT ON COLUMN email_links.short_url IS 'Short URL that redirects to original';

-- Indexes
CREATE INDEX idx_email_links_tracking_code ON email_links(tracking_code);
CREATE INDEX idx_email_links_campaign_id ON email_links(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_email_links_message_id ON email_links(message_id) WHERE message_id IS NOT NULL;

-- =====================================================
-- PART 5: EMAIL TEMPLATES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template Info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- marketing, transactional, crm, etc.
  
  -- Template Content
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  
  -- Variables
  variables JSONB DEFAULT '[]'::jsonb, -- ["{{name}}", "{{company}}", etc.]
  sample_variables JSONB DEFAULT '{}'::jsonb, -- Sample data for preview
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE email_templates IS 'Reusable email templates for campaigns';
COMMENT ON COLUMN email_templates.variables IS 'List of template variables that can be replaced';

-- Index
CREATE INDEX idx_email_templates_category ON email_templates(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_email_templates_is_active ON email_templates(is_active) WHERE deleted_at IS NULL;

-- =====================================================
-- PART 6: UPDATE TRIGGERS
-- =====================================================

-- Updated_at trigger for email_campaigns
CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Updated_at trigger for email_messages
CREATE TRIGGER update_email_messages_updated_at
  BEFORE UPDATE ON email_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Updated_at trigger for email_links
CREATE TRIGGER update_email_links_updated_at
  BEFORE UPDATE ON email_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Updated_at trigger for email_templates
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PART 7: HELPER FUNCTIONS
-- =====================================================

-- Function to update campaign stats when message events occur
CREATE OR REPLACE FUNCTION update_email_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL THEN
    UPDATE email_campaigns
    SET
      total_delivered = (SELECT COUNT(*) FROM email_messages WHERE campaign_id = NEW.campaign_id AND status = 'delivered' AND deleted_at IS NULL),
      total_bounced = (SELECT COUNT(*) FROM email_messages WHERE campaign_id = NEW.campaign_id AND status = 'bounced' AND deleted_at IS NULL),
      total_opened = (SELECT COUNT(*) FROM email_messages WHERE campaign_id = NEW.campaign_id AND opened_at IS NOT NULL AND deleted_at IS NULL),
      total_clicked = (SELECT COUNT(*) FROM email_messages WHERE campaign_id = NEW.campaign_id AND clicked_at IS NOT NULL AND deleted_at IS NULL),
      total_unsubscribed = (SELECT COUNT(*) FROM email_messages WHERE campaign_id = NEW.campaign_id AND unsubscribed_at IS NOT NULL AND deleted_at IS NULL),
      total_complained = (SELECT COUNT(*) FROM email_messages WHERE campaign_id = NEW.campaign_id AND complained_at IS NOT NULL AND deleted_at IS NULL),
      updated_at = NOW()
    WHERE id = NEW.campaign_id;
    
    -- Update rates
    UPDATE email_campaigns
    SET
      delivery_rate = CASE WHEN total_sent > 0 THEN ROUND((total_delivered::DECIMAL / total_sent::DECIMAL) * 100, 2) ELSE 0 END,
      open_rate = CASE WHEN total_delivered > 0 THEN ROUND((total_opened::DECIMAL / total_delivered::DECIMAL) * 100, 2) ELSE 0 END,
      click_rate = CASE WHEN total_delivered > 0 THEN ROUND((total_clicked::DECIMAL / total_delivered::DECIMAL) * 100, 2) ELSE 0 END,
      bounce_rate = CASE WHEN total_sent > 0 THEN ROUND((total_bounced::DECIMAL / total_sent::DECIMAL) * 100, 2) ELSE 0 END
    WHERE id = NEW.campaign_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update campaign stats
CREATE TRIGGER update_campaign_stats_on_message_change
  AFTER INSERT OR UPDATE ON email_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_email_campaign_stats();

-- =====================================================
-- PART 8: RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Email Campaigns Policies
CREATE POLICY "Users can view their own campaigns" ON email_campaigns
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create campaigns" ON email_campaigns
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own campaigns" ON email_campaigns
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Root and admins can view all campaigns" ON email_campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('root', 'company_admin')
    )
  );

-- Email Messages Policies
CREATE POLICY "Users can view messages for their campaigns" ON email_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM email_campaigns
      WHERE email_campaigns.id = email_messages.campaign_id
      AND email_campaigns.created_by = auth.uid()
    )
  );

CREATE POLICY "Service role can manage email messages" ON email_messages
  FOR ALL USING (auth.uid() IS NULL); -- Service role bypass

-- Email Events Policies (read-only for users)
CREATE POLICY "Users can view events for their messages" ON email_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM email_messages em
      JOIN email_campaigns ec ON ec.id = em.campaign_id
      WHERE em.id = email_events.message_id
      AND ec.created_by = auth.uid()
    )
  );

-- Email Links Policies
CREATE POLICY "Users can view links for their campaigns" ON email_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM email_campaigns
      WHERE email_campaigns.id = email_links.campaign_id
      AND email_campaigns.created_by = auth.uid()
    )
  );

-- Email Templates Policies
CREATE POLICY "Users can view active templates" ON email_templates
  FOR SELECT USING (is_active = true AND deleted_at IS NULL);

CREATE POLICY "Admins can manage templates" ON email_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('root', 'company_admin')
    )
  );

-- =====================================================
-- PART 9: SAMPLE DATA (for development)
-- =====================================================

-- Insert sample email template
INSERT INTO email_templates (name, description, category, subject, html_content, text_content, variables, sample_variables, is_active)
VALUES (
  'Welcome Email',
  'Welcome email for new contacts',
  'crm',
  'Welcome to TSmart Warehouse, {{name}}!',
  '<html><body><h1>Welcome {{name}}!</h1><p>We''re excited to have you at {{company}}.</p></body></html>',
  'Welcome {{name}}! We''re excited to have you at {{company}}.',
  '["{{name}}", "{{company}}"]'::jsonb,
  '{"name": "John Doe", "company": "ABC Corp"}'::jsonb,
  true
);

-- =====================================================
-- Migration Complete
-- =====================================================

COMMENT ON SCHEMA public IS 'Email tracking system for CRM communications - Migration 120';
