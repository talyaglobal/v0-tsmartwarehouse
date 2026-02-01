-- Migration: Cleanup all booking triggers and recreate essential ones
-- Created: 2026-02-01
-- Purpose: Fix "column booking_type does not exist" error by ensuring all triggers use correct column names

-- =====================================================
-- PART 1: DROP ALL TRIGGERS ON BOOKINGS TABLE
-- =====================================================

-- Notification triggers
DROP TRIGGER IF EXISTS notify_booking_requested ON bookings;
DROP TRIGGER IF EXISTS notify_booking_approved ON bookings;
DROP TRIGGER IF EXISTS notify_booking_rejected ON bookings;

-- Capacity triggers
DROP TRIGGER IF EXISTS trigger_booking_capacity ON bookings;

-- Status notification triggers
DROP TRIGGER IF EXISTS trigger_booking_notification ON bookings;

-- Audit triggers
DROP TRIGGER IF EXISTS trigger_audit_bookings ON bookings;

-- Deletion prevention triggers
DROP TRIGGER IF EXISTS trigger_prevent_booking_delete ON bookings;

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;

-- Availability triggers
DROP TRIGGER IF EXISTS trigger_update_warehouse_availability ON bookings;

-- Any other triggers that might exist
DROP TRIGGER IF EXISTS booking_status_change ON bookings;
DROP TRIGGER IF EXISTS booking_insert_trigger ON bookings;
DROP TRIGGER IF EXISTS booking_update_trigger ON bookings;

-- =====================================================
-- PART 2: RECREATE ESSENTIAL TRIGGER FUNCTIONS
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Update warehouse capacity (uses booking_status, not status)
CREATE OR REPLACE FUNCTION update_warehouse_capacity()
RETURNS TRIGGER AS $$
DECLARE
    warehouse_uuid UUID;
    used_pallets INT;
    total_pallets INT;
BEGIN
    -- Determine which warehouse to update
    IF TG_OP = 'DELETE' THEN
        warehouse_uuid := OLD.warehouse_id;
    ELSE
        warehouse_uuid := NEW.warehouse_id;
    END IF;
    
    -- Skip if no warehouse
    IF warehouse_uuid IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Calculate used pallets from active bookings (using pallet_count and booking_status)
    SELECT COALESCE(SUM(COALESCE(pallet_count, 0)), 0)
    INTO used_pallets
    FROM bookings
    WHERE warehouse_id = warehouse_uuid
    AND booking_status IN ('active', 'confirmed', 'pending');
    
    -- Get total capacity
    SELECT COALESCE(total_pallet_storage, 0)
    INTO total_pallets
    FROM warehouses
    WHERE id = warehouse_uuid;
    
    -- Update available capacity
    UPDATE warehouses
    SET available_pallet_storage = GREATEST(0, total_pallets - used_pallets),
        updated_at = now()
    WHERE id = warehouse_uuid;
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
    -- Don't fail the main operation
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function: Create notification event (simplified version without booking_type reference)
CREATE OR REPLACE FUNCTION create_notification_event()
RETURNS TRIGGER AS $$
DECLARE
  event_type_value TEXT;
  entity_type_value TEXT;
  entity_id_value TEXT;
  payload_data JSONB;
  warehouse_owner_id UUID;
BEGIN
  -- Handle bookings table events
  IF TG_TABLE_NAME = 'bookings' THEN
    entity_type_value := 'booking';
    entity_id_value := NEW.id;
    
    -- Get warehouse owner ID
    IF NEW.warehouse_id IS NOT NULL THEN
      SELECT owner_company_id INTO warehouse_owner_id
      FROM warehouses
      WHERE id = NEW.warehouse_id;
    END IF;
    
    -- Handle INSERT (new booking)
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'booking.requested';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'bookingId', NEW.id,
        'customerId', NEW.customer_id,
        'warehouseId', NEW.warehouse_id,
        'warehouseOwnerId', warehouse_owner_id,
        'bookingType', NEW.type,  -- Note: 'type' column, key is 'bookingType'
        'palletCount', NEW.pallet_count,
        'areaSqFt', NEW.area_sq_ft,
        'startDate', NEW.start_date,
        'timestamp', NOW()
      );
    
    -- Handle UPDATE (status change)
    ELSIF TG_OP = 'UPDATE' THEN
      -- Only process if booking_status changed
      IF OLD.booking_status IS DISTINCT FROM NEW.booking_status THEN
        IF NEW.booking_status = 'confirmed' THEN
          event_type_value := 'booking.approved';
        ELSIF NEW.booking_status = 'cancelled' THEN
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
          'warehouseId', NEW.warehouse_id,
          'warehouseOwnerId', warehouse_owner_id,
          'oldStatus', OLD.booking_status,
          'newStatus', NEW.booking_status,
          'timestamp', NOW()
        );
      END IF;
    END IF;
  
  -- Handle invoices table events
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    entity_type_value := 'invoice';
    entity_id_value := NEW.id::TEXT;
    
    IF TG_OP = 'INSERT' THEN
      event_type_value := 'invoice.generated';
      payload_data := jsonb_build_object(
        'eventType', event_type_value,
        'entityType', entity_type_value,
        'entityId', entity_id_value,
        'invoiceId', NEW.id,
        'customerId', NEW.customer_id,
        'amount', NEW.total,
        'timestamp', NOW()
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.invoice_status != 'paid' AND NEW.invoice_status = 'paid' THEN
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
  END IF;
  
  -- Insert notification event if we have payload
  IF event_type_value IS NOT NULL AND payload_data IS NOT NULL THEN
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
EXCEPTION WHEN others THEN
  -- Log but don't fail
  RAISE WARNING 'Notification event creation failed: %', SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Prevent deletion of active bookings
CREATE OR REPLACE FUNCTION prevent_active_booking_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.booking_status IN ('active', 'confirmed', 'pending') THEN
        RAISE EXCEPTION 'Cannot delete booking with status: %. Please cancel first.', OLD.booking_status;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function: Audit log changes
CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id UUID;
    old_data JSONB;
    new_data JSONB;
BEGIN
    -- Try to get current user from session
    audit_user_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
    
    -- Prepare data
    IF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        new_data := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        old_data := NULL;
        new_data := to_jsonb(NEW);
    ELSE
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
    END IF;
    
    -- Insert audit log
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values,
        ip_address,
        created_at
    ) VALUES (
        audit_user_id,
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        old_data,
        new_data,
        NULLIF(current_setting('app.client_ip', true), ''),
        now()
    );
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
    -- Don't fail the main operation if audit fails
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 3: RECREATE ESSENTIAL TRIGGERS
-- =====================================================

-- Trigger: Update updated_at on booking update
CREATE TRIGGER update_bookings_updated_at 
  BEFORE UPDATE ON bookings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update warehouse capacity on booking changes
CREATE TRIGGER trigger_booking_capacity
  AFTER INSERT OR UPDATE OF booking_status OR DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_warehouse_capacity();

-- Trigger: Prevent deletion of active bookings
CREATE TRIGGER trigger_prevent_booking_delete
  BEFORE DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_active_booking_deletion();

-- Trigger: Create notification events for new bookings
-- Note: Using simpler trigger without WHEN clause to avoid column reference issues
CREATE TRIGGER notify_booking_requested
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_event();

-- Trigger: Create notification events for status changes
CREATE TRIGGER notify_booking_status_changed
  AFTER UPDATE OF booking_status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_event();

-- Trigger: Audit log for bookings
CREATE TRIGGER trigger_audit_bookings
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_changes();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION update_warehouse_capacity() IS 
  'Automatically recalculates warehouse available capacity when bookings change. Uses booking_status column.';

COMMENT ON FUNCTION create_notification_event() IS 
  'Creates notification events for booking and invoice status changes. Uses type column for booking type, booking_status for status.';

COMMENT ON FUNCTION prevent_active_booking_deletion() IS 
  'Prevents deletion of bookings with active/confirmed/pending status.';
