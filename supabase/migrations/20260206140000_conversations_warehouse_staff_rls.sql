-- RLS: Warehouse staff can view and participate in conversations for their assigned warehouses.
-- Staff can SELECT conversations where warehouse_id is in their warehouse_staff assignments.
-- Staff can SELECT/INSERT warehouse_messages for those conversations (receiver_id set by app).

-- Conversations: allow warehouse staff to SELECT conversations for their warehouses
DROP POLICY IF EXISTS "Warehouse staff can view conversations for their warehouses" ON public.conversations;
CREATE POLICY "Warehouse staff can view conversations for their warehouses"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    warehouse_id IN (
      SELECT warehouse_id FROM public.warehouse_staff
      WHERE user_id = auth.uid() AND status = true
    )
  );

-- Warehouse_messages: allow warehouse staff to SELECT messages in conversations they can access
DROP POLICY IF EXISTS "Users can view messages in accessible conversations" ON public.warehouse_messages;
-- Keep original policy name for sender/receiver; add policy for conversation-based access
CREATE POLICY "Warehouse staff can view conversation messages"
  ON public.warehouse_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = warehouse_messages.conversation_id
      AND c.warehouse_id IN (
        SELECT warehouse_id FROM public.warehouse_staff
        WHERE user_id = auth.uid() AND status = true
      )
    )
  );

-- Warehouse_messages INSERT: already "sender_id = auth.uid()" so staff can send; receiver_id set by app.
