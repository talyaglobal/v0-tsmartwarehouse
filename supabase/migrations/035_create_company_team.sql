-- Create company team management tables
-- This allows companies to manage team members and send invitations

-- Company members table
CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_status ON company_members(status);
CREATE INDEX IF NOT EXISTS idx_company_members_role ON company_members(role);

-- Enable Row Level Security
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own memberships
CREATE POLICY "Users can view own memberships"
  ON company_members FOR SELECT
  USING (auth.uid() = user_id);

-- Company admins can view all members of their company
CREATE POLICY "Company admins can view members"
  ON company_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members AS cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.status = 'active'
    )
  );

-- Company admins can manage members
CREATE POLICY "Company admins can manage members"
  ON company_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM company_members AS cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
      AND cm.status = 'active'
    )
  );

-- System admins can manage all members
CREATE POLICY "Admins can manage all members"
  ON company_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Company invitations table
CREATE TABLE IF NOT EXISTS company_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by UUID NOT NULL REFERENCES profiles(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_company_invitations_company_id ON company_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invitations_email ON company_invitations(email);
CREATE INDEX IF NOT EXISTS idx_company_invitations_token ON company_invitations(token);
CREATE INDEX IF NOT EXISTS idx_company_invitations_expires_at ON company_invitations(expires_at);

-- Enable Row Level Security
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Company admins can view invitations for their company
CREATE POLICY "Company admins can view invitations"
  ON company_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = company_invitations.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
      AND company_members.status = 'active'
    )
  );

-- Company admins can create invitations
CREATE POLICY "Company admins can create invitations"
  ON company_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = company_invitations.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
      AND company_members.status = 'active'
    )
  );

-- Anyone with the token can view the invitation (for acceptance)
CREATE POLICY "Token holders can view invitation"
  ON company_invitations FOR SELECT
  USING (
    token = current_setting('app.invitation_token', true)
    OR EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = company_invitations.company_id
      AND company_members.user_id = auth.uid()
      AND company_members.role IN ('owner', 'admin')
      AND company_members.status = 'active'
    )
  );

-- System admins can manage all invitations
CREATE POLICY "Admins can manage all invitations"
  ON company_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

