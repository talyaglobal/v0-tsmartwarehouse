-- Allow both team admin and team member to book on behalf of same-team members.
-- Admin can create pre-approved or require-approval; member must require approval (enforced in API).
CREATE OR REPLACE FUNCTION can_book_on_behalf(p_booker_id UUID, p_customer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Booker and customer must be in the same team (any role)
  RETURN EXISTS (
    SELECT 1 FROM client_team_members tm1
    JOIN client_team_members tm2 ON tm1.team_id = tm2.team_id
    JOIN client_teams ct ON tm1.team_id = ct.id
    WHERE tm1.member_id = p_booker_id
    AND tm2.member_id = p_customer_id
    AND ct.status = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_book_on_behalf IS 'Check if booker and customer are in the same team (admin or member). Members must require approval when booking on behalf (enforced in API).';
