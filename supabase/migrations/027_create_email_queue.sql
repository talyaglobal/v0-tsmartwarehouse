-- Create email queue table for reliable email delivery
-- This table stores emails that need to be sent with retry mechanism

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  priority INTEGER DEFAULT 0, -- Higher = more urgent (0 = normal, 10 = urgent)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB, -- Additional metadata (template name, event type, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON email_queue(status, priority DESC, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_failed ON email_queue(status, retry_count, created_at) WHERE status = 'failed' AND retry_count < max_retries;

-- Enable Row Level Security
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only system/service role can access email queue
CREATE POLICY "Service role can manage email queue"
  ON email_queue
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update sent_at timestamp
CREATE OR REPLACE FUNCTION update_email_queue_sent_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    NEW.sent_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update sent_at
CREATE TRIGGER update_email_queue_sent_at_trigger
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_email_queue_sent_at();

