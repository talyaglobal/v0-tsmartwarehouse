-- Create notification_events table for event queue
-- This table stores events that need to be processed for notifications

CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'booking', 'invoice', 'warehouse', 'proposal', 'modification', 'team_member', 'invitation'
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_events_status ON notification_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_events_entity ON notification_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_type ON notification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_pending ON notification_events(status) WHERE status = 'pending';

-- Enable Row Level Security
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only system/service role can access notification events
CREATE POLICY "Service role can manage notification events"
  ON notification_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp (if needed in future)
CREATE OR REPLACE FUNCTION update_notification_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.processed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

