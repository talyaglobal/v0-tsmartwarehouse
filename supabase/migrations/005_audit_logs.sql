-- Audit Logs Table
-- Tracks all user actions for security and compliance

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'create', 'update', 'delete', 'view', 'login', 'logout',
    'export', 'import', 'approve', 'reject', 'assign', 'complete'
  )),
  entity TEXT NOT NULL CHECK (entity IN (
    'booking', 'invoice', 'claim', 'incident', 'task', 'user', 'warehouse', 'system'
  )),
  entity_id TEXT NOT NULL,
  changes JSONB,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_entity ON audit_logs(user_id, entity, created_at DESC);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: System can insert audit logs (via service role)
-- Note: This is handled via service role key, not RLS
-- RLS policies don't apply when using service role key

COMMENT ON TABLE audit_logs IS 'Audit trail for all user actions in the system';
COMMENT ON COLUMN audit_logs.changes IS 'JSON object containing old and new values for updates';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context about the action';

