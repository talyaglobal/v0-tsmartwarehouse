-- Migration: Fix booking notification triggers
-- Created: 2026-02-01
-- Purpose: Update triggers to use booking_status instead of status (which was renamed)

-- =====================================================
-- PART 1: DROP OLD TRIGGERS THAT USE OUTDATED COLUMN NAMES
-- =====================================================

-- Drop old triggers that reference 'status' column (renamed to booking_status)
DROP TRIGGER IF EXISTS notify_booking_requested ON bookings;
DROP TRIGGER IF EXISTS notify_booking_approved ON bookings;
DROP TRIGGER IF EXISTS notify_booking_rejected ON bookings;

-- =====================================================
-- PART 2: UPDATE THE NOTIFICATION EVENT FUNCTION
-- =====================================================

-- Update create_notification_event function to use booking_status
CREATE OR REPLACE FUNCTION create_notification_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type_value TEXT;
  entity_type_value TEXT;
  entity_id_value UUID;
  payload_data JSONB;
  warehouse_owner_id UUID;
BEGIN
  -- Determine entity type based on TG_TABLE_NAME
  entity_type_value := TG_TABLE_NAME;
  
  -- Handle different table types
  IF TG_TABLE_NAME = 'bookings' THEN
    entity_id_value := NEW.customer_id;
    
    -- Get warehouse owner ID
    SELECT owner_company_id INTO warehouse_owner_id
    FROM warehouses 
    WHERE id = NEW.warehouse_id;
    
    IF TG_OP = 'INSERT' AND NEW.booking_status = 'pending' THEN
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
    ELSIF TG_OP = 'UPDATE' AND OLD.booking_status = 'pending' AND NEW.booking_status = 'confirmed' THEN
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
    ELSIF TG_OP = 'UPDATE' AND OLD.booking_status = 'pending' AND NEW.booking_status = 'cancelled' THEN
      event_type_value := 'booking.rejected';
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
    ELSE
      -- No matching condition, return without creating event
      RETURN COALESCE(NEW, OLD);
    END IF;
    
  ELSIF TG_TABLE_NAME = 'booking_proposals' THEN
    entity_id_value := NEW.id;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'booking.proposal.created';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'proposalId', NEW.id,
        'bookingId', NEW.booking_id,
        'proposedBy', NEW.proposed_by,
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
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
    
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    entity_id_value := NEW.id;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'invoice.created';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'invoiceId', NEW.id,
        'customerId', NEW.customer_id,
        'amount', NEW.total,
        'dueDate', NEW.due_date,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND NEW.invoice_status = 'paid' AND OLD.invoice_status != 'paid' THEN
      event_type_value := 'invoice.paid';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'invoiceId', NEW.id,
        'customerId', NEW.customer_id,
        'amount', NEW.total,
        'timestamp', NOW()
      );
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
  ELSE
    -- Unknown table, return without action
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Insert notification event if payload was built
  IF payload_data IS NOT NULL THEN
    INSERT INTO notification_events (
      event_type,
      entity_type,
      entity_id,
      payload,
      created_at
    ) VALUES (
      event_type_value,
      entity_type_value,
      entity_id_value,
      payload_data,
      NOW()
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Notification event creation failed: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 3: RECREATE TRIGGERS WITH CORRECT COLUMN NAMES
-- =====================================================

-- Create triggers for bookings table using booking_status
CREATE TRIGGER notify_booking_requested
  AFTER INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.booking_status = 'pending')
  EXECUTE FUNCTION create_notification_event();

CREATE TRIGGER notify_booking_approved
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.booking_status = 'pending' AND NEW.booking_status = 'confirmed')
  EXECUTE FUNCTION create_notification_event();

CREATE TRIGGER notify_booking_rejected
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.booking_status = 'pending' AND NEW.booking_status = 'cancelled')
  EXECUTE FUNCTION create_notification_event();

-- =====================================================
-- PART 4: FIX INVOICE TRIGGER TO USE invoice_status
-- =====================================================

DROP TRIGGER IF EXISTS notify_invoice_paid ON invoices;
CREATE TRIGGER notify_invoice_paid
  AFTER UPDATE ON invoices
  FOR EACH ROW
  WHEN (OLD.invoice_status != 'paid' AND NEW.invoice_status = 'paid')
  EXECUTE FUNCTION create_notification_event();

-- Add comment
COMMENT ON FUNCTION create_notification_event() IS 'Creates notification events when bookings, proposals, or invoices are created/updated. Uses booking_status and invoice_status columns.';
