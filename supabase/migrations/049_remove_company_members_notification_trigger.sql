-- Remove company_members trigger logic from notification triggers
-- Since company_members table was removed, we need to remove this trigger logic
-- The trigger function will be updated to remove the company_members case

-- First, check if the trigger function exists and update it
-- We'll create a new version that doesn't reference company_members
CREATE OR REPLACE FUNCTION create_notification_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type_value TEXT;
  entity_type_value TEXT;
  entity_id_value UUID;
  payload_data JSONB;
BEGIN
  -- Initialize variables
  entity_type_value := NULL;
  entity_id_value := NULL;
  payload_data := jsonb_build_object();
  
  -- Determine entity type and ID based on table name
  IF TG_TABLE_NAME = 'bookings' THEN
    entity_type_value := 'booking';
    entity_id_value := NEW.id;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'booking.requested';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'bookingId', NEW.id,
        'customerId', NEW.customer_id,
        'status', NEW.status,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.status != NEW.status THEN
        IF NEW.status = 'approved' THEN
          event_type_value := 'booking.approved';
        ELSIF NEW.status = 'rejected' THEN
          event_type_value := 'booking.rejected';
        ELSE
          event_type_value := 'booking.status_changed';
        END IF;
        
        payload_data := jsonb_build_object(
          'eventType', event_type_value,
          'entityType', entity_type_value,
          'entityId', entity_id_value,
          'bookingId', NEW.id,
          'customerId', NEW.customer_id,
          'oldStatus', OLD.status,
          'newStatus', NEW.status,
          'timestamp', NOW()
        );
      END IF;
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
        'customerId', NEW.customer_id,
        'amount', NEW.total,
        'status', NEW.status,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'paid' THEN
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
    END IF;
    
  ELSIF TG_TABLE_NAME = 'warehouse_halls' THEN
    entity_type_value := 'warehouse_hall';
    entity_id_value := NEW.id;
    
    IF TG_OP = 'UPDATE' AND (OLD.occupied_sq_ft != NEW.occupied_sq_ft OR OLD.available_sq_ft != NEW.available_sq_ft) THEN
      event_type_value := 'warehouse.occupancy_updated';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'hallId', NEW.id,
        'warehouseId', NEW.warehouse_id,
        'oldOccupied', OLD.occupied_sq_ft,
        'newOccupied', NEW.occupied_sq_ft,
        'oldAvailable', OLD.available_sq_ft,
        'newAvailable', NEW.available_sq_ft,
        'timestamp', NOW()
      );
    END IF;
    
  -- company_members case removed - table no longer exists
  -- Team member joined events should be triggered manually from application code if needed
  
  END IF;
  
  -- Only create event if we have valid event type
  IF event_type_value IS NOT NULL THEN
    INSERT INTO notification_events (event_type, entity_type, entity_id, payload, created_at)
    VALUES (event_type_value, entity_type_value, entity_id_value, payload_data, NOW());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

