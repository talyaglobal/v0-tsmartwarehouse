-- Create database triggers for automatic event creation
-- These triggers automatically create notification_events when important changes occur

-- Function to create notification event
CREATE OR REPLACE FUNCTION create_notification_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type_value TEXT;
  entity_type_value TEXT;
  entity_id_value UUID;
  payload_data JSONB;
  warehouse_owner_id UUID;
  customer_id_value UUID;
BEGIN
  -- Determine event type and entity type based on table and operation
  IF TG_TABLE_NAME = 'bookings' THEN
    entity_type_value := 'booking';
    entity_id_value := NEW.id;
    
    -- Get warehouse owner ID from warehouse
    IF NEW.warehouse_id IS NOT NULL THEN
      SELECT owner_company_id INTO warehouse_owner_id
      FROM warehouses
      WHERE id = NEW.warehouse_id;
    END IF;
    
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
      event_type_value := 'booking.requested';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'bookingId', NEW.id,
        'customerId', NEW.customer_id,
        'warehouseId', NEW.warehouse_id,
        'warehouseOwnerId', warehouse_owner_id,
        'bookingType', NEW.type,
        'palletCount', NEW.pallet_count,
        'areaSqFt', NEW.area_sq_ft,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
      event_type_value := 'booking.approved';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'bookingId', NEW.id,
        'customerId', NEW.customer_id,
        'warehouseId', NEW.warehouse_id,
        'warehouseOwnerId', warehouse_owner_id,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
      event_type_value := 'booking.rejected';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'bookingId', NEW.id,
        'customerId', NEW.customer_id,
        'warehouseOwnerId', warehouse_owner_id,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'booking_proposals' THEN
    entity_type_value := 'proposal';
    entity_id_value := NEW.id;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'booking.proposal.created';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'proposalId', NEW.id,
        'bookingId', NEW.booking_id,
        'proposedPrice', NEW.proposed_price,
        'expiresAt', NEW.expires_at,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
      event_type_value := 'booking.proposal.accepted';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'proposalId', NEW.id,
        'bookingId', NEW.booking_id,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
      event_type_value := 'booking.proposal.rejected';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'proposalId', NEW.id,
        'bookingId', NEW.booking_id,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    entity_type_value := 'invoice';
    entity_id_value := NEW.id;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'invoice.generated';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'invoiceId', NEW.id,
        'bookingId', NEW.booking_id,
        'customerId', NEW.customer_id,
        'amount', NEW.total,
        'dueDate', NEW.due_date,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'paid' AND OLD.status != 'paid' THEN
      event_type_value := 'invoice.paid';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'invoiceId', NEW.id,
        'bookingId', NEW.booking_id,
        'customerId', NEW.customer_id,
        'amount', NEW.total,
        'paidAt', NEW.paid_date,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'booking_modifications' THEN
    entity_type_value := 'modification';
    entity_id_value := NEW.id;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'booking.modified';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'modificationId', NEW.id,
        'bookingId', NEW.booking_id,
        'modificationType', NEW.modification_type,
        'oldValue', NEW.old_value,
        'newValue', NEW.new_value,
        'effectiveDate', NEW.effective_date,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'company_invitations' THEN
    entity_type_value := 'invitation';
    entity_id_value := NEW.id;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'team.member.invited';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'invitationId', NEW.id,
        'companyId', NEW.company_id,
        'invitedEmail', NEW.email,
        'invitedBy', NEW.invited_by,
        'role', NEW.role,
        'expiresAt', NEW.expires_at,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'company_members' THEN
    entity_type_value := 'team_member';
    entity_id_value := NEW.id;
    
    IF TG_OP = 'INSERT' AND NEW.status = 'active' AND NEW.joined_at IS NOT NULL THEN
      event_type_value := 'team.member.joined';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'memberId', NEW.id,
        'companyId', NEW.company_id,
        'userId', NEW.user_id,
        'role', NEW.role,
        'timestamp', NOW()
      );
    END IF;
    
  ELSIF TG_TABLE_NAME = 'warehouse_halls' THEN
    entity_type_value := 'warehouse';
    
    -- Get warehouse ID from hall
    SELECT warehouse_id INTO entity_id_value
    FROM warehouse_floors
    WHERE id = NEW.floor_id;
    
    IF TG_OP = 'UPDATE' AND (OLD.occupied_sq_ft != NEW.occupied_sq_ft OR OLD.available_sq_ft != NEW.available_sq_ft) THEN
      -- Get warehouse owner
      SELECT owner_company_id INTO warehouse_owner_id
      FROM warehouses
      WHERE id = entity_id_value;
      
      event_type_value := 'warehouse.occupancy.updated';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'warehouseId', entity_id_value,
        'warehouseOwnerId', warehouse_owner_id,
        'occupancyPercent', CASE 
          WHEN NEW.sq_ft > 0 THEN (NEW.occupied_sq_ft::DECIMAL / NEW.sq_ft::DECIMAL * 100)
          ELSE 0
        END,
        'availableSqFt', NEW.available_sq_ft,
        'occupiedSqFt', NEW.occupied_sq_ft,
        'updatedBy', COALESCE(current_setting('app.user_id', true), 'system'),
        'timestamp', NOW()
      );
    END IF;
  END IF;
  
  -- Insert notification event if we have valid data
  IF event_type_value IS NOT NULL AND payload_data IS NOT NULL THEN
    INSERT INTO notification_events (
      event_type,
      entity_type,
      entity_id,
      payload,
      status
    ) VALUES (
      event_type_value,
      entity_type_value,
      entity_id_value,
      payload_data,
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for bookings table
DROP TRIGGER IF EXISTS notify_booking_requested ON bookings;
CREATE TRIGGER notify_booking_requested
  AFTER INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION create_notification_event();

DROP TRIGGER IF EXISTS notify_booking_approved ON bookings;
CREATE TRIGGER notify_booking_approved
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status = 'confirmed')
  EXECUTE FUNCTION create_notification_event();

DROP TRIGGER IF EXISTS notify_booking_rejected ON bookings;
CREATE TRIGGER notify_booking_rejected
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status = 'cancelled')
  EXECUTE FUNCTION create_notification_event();

-- Create triggers for booking_proposals table (will be created in later migration)
-- These are prepared for when the table exists
-- DROP TRIGGER IF EXISTS notify_proposal_created ON booking_proposals;
-- CREATE TRIGGER notify_proposal_created
--   AFTER INSERT ON booking_proposals
--   FOR EACH ROW
--   EXECUTE FUNCTION create_notification_event();
--
-- DROP TRIGGER IF EXISTS notify_proposal_status_changed ON booking_proposals;
-- CREATE TRIGGER notify_proposal_status_changed
--   AFTER UPDATE ON booking_proposals
--   FOR EACH ROW
--   WHEN (OLD.status != NEW.status)
--   EXECUTE FUNCTION create_notification_event();

-- Create triggers for invoices table
DROP TRIGGER IF EXISTS notify_invoice_generated ON invoices;
CREATE TRIGGER notify_invoice_generated
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_event();

DROP TRIGGER IF EXISTS notify_invoice_paid ON invoices;
CREATE TRIGGER notify_invoice_paid
  AFTER UPDATE ON invoices
  FOR EACH ROW
  WHEN (OLD.status != 'paid' AND NEW.status = 'paid')
  EXECUTE FUNCTION create_notification_event();

-- Create trigger for warehouse_halls occupancy updates
DROP TRIGGER IF EXISTS notify_warehouse_occupancy_updated ON warehouse_halls;
CREATE TRIGGER notify_warehouse_occupancy_updated
  AFTER UPDATE ON warehouse_halls
  FOR EACH ROW
  WHEN (OLD.occupied_sq_ft != NEW.occupied_sq_ft OR OLD.available_sq_ft != NEW.available_sq_ft)
  EXECUTE FUNCTION create_notification_event();

-- Note: Triggers for booking_modifications, company_invitations, and company_members
-- will be created in later migrations when those tables are created

