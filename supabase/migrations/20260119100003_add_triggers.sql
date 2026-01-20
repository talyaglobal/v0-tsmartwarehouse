-- Migration: Add Triggers for Data Consistency
-- Description: Automatic updated_at, capacity calculations, notifications, and audit logs

-- =============================================
-- 1. GENERIC UPDATED_AT TRIGGER
-- =============================================

-- Create the function once
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
        AND table_name NOT LIKE 'pg_%'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_update_updated_at ON %I;
            CREATE TRIGGER trigger_update_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t.table_name, t.table_name);
    END LOOP;
END $$;

-- =============================================
-- 2. WAREHOUSE CAPACITY CALCULATION TRIGGER
-- =============================================

-- Function to update warehouse available capacity
CREATE OR REPLACE FUNCTION update_warehouse_capacity()
RETURNS TRIGGER AS $$
DECLARE
    warehouse_uuid UUID;
    total_pallets INT;
    used_pallets INT;
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
    
    -- Calculate used pallets from active bookings (using pallet_count)
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
END;
$$ LANGUAGE plpgsql;

-- Trigger on bookings
DROP TRIGGER IF EXISTS trigger_booking_capacity ON bookings;
CREATE TRIGGER trigger_booking_capacity
AFTER INSERT OR UPDATE OF booking_status OR DELETE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_warehouse_capacity();

-- =============================================
-- 3. CUSTOMER STOCK LEVELS UPDATE TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION update_customer_stock_levels()
RETURNS TRIGGER AS $$
DECLARE
    cust_id UUID;
    wh_id UUID;
    total_items INT;
    total_pallets INT;
BEGIN
    -- Determine customer and warehouse
    IF TG_OP = 'DELETE' THEN
        cust_id := OLD.customer_id;
        wh_id := OLD.warehouse_id;
    ELSE
        cust_id := NEW.customer_id;
        wh_id := NEW.warehouse_id;
    END IF;
    
    -- Skip if no customer
    IF cust_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Calculate totals for this customer at this warehouse
    SELECT 
        COUNT(*),
        COUNT(DISTINCT pallet_id)
    INTO total_items, total_pallets
    FROM inventory_items
    WHERE customer_id = cust_id
    AND warehouse_id = wh_id
    AND inventory_item_status = 'stored';
    
    -- Upsert into customer_stock_levels
    INSERT INTO customer_stock_levels (customer_id, warehouse_id, total_items, total_pallets, updated_at)
    VALUES (cust_id, wh_id, total_items, total_pallets, now())
    ON CONFLICT (customer_id, warehouse_id) 
    DO UPDATE SET 
        total_items = EXCLUDED.total_items,
        total_pallets = EXCLUDED.total_pallets,
        updated_at = now();
    
    RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
    -- Don't fail the main operation if stock levels update fails
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on inventory_items
DROP TRIGGER IF EXISTS trigger_inventory_stock_levels ON inventory_items;
CREATE TRIGGER trigger_inventory_stock_levels
AFTER INSERT OR UPDATE OF inventory_item_status, customer_id, warehouse_id OR DELETE ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION update_customer_stock_levels();

-- =============================================
-- 4. BOOKING STATUS CHANGE NOTIFICATION TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION notify_booking_status_change()
RETURNS TRIGGER AS $$
DECLARE
    notif_title TEXT;
    notif_message TEXT;
    notif_type TEXT;
BEGIN
    -- Only trigger on status change
    IF OLD.booking_status = NEW.booking_status THEN
        RETURN NEW;
    END IF;
    
    -- Set notification details based on new status
    CASE NEW.booking_status
        WHEN 'confirmed' THEN
            notif_title := 'Booking Confirmed';
            notif_message := format('Your booking #%s has been confirmed.', LEFT(NEW.id::text, 8));
            notif_type := 'booking_confirmed';
        WHEN 'cancelled' THEN
            notif_title := 'Booking Cancelled';
            notif_message := format('Booking #%s has been cancelled.', LEFT(NEW.id::text, 8));
            notif_type := 'booking_cancelled';
        WHEN 'completed' THEN
            notif_title := 'Booking Completed';
            notif_message := format('Your booking #%s has been completed.', LEFT(NEW.id::text, 8));
            notif_type := 'booking_completed';
        WHEN 'active' THEN
            notif_title := 'Booking Active';
            notif_message := format('Your booking #%s is now active.', LEFT(NEW.id::text, 8));
            notif_type := 'booking_active';
        ELSE
            RETURN NEW; -- No notification for other statuses
    END CASE;
    
    -- Create notification for customer
    INSERT INTO notifications (user_id, title, message, type, read, data, created_at)
    VALUES (
        NEW.customer_id,
        notif_title,
        notif_message,
        notif_type,
        false,
        jsonb_build_object('booking_id', NEW.id, 'status', NEW.booking_status),
        now()
    );
    
    RETURN NEW;
EXCEPTION WHEN others THEN
    -- Don't fail the booking update if notification fails
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on bookings
DROP TRIGGER IF EXISTS trigger_booking_notification ON bookings;
CREATE TRIGGER trigger_booking_notification
AFTER UPDATE OF booking_status ON bookings
FOR EACH ROW
EXECUTE FUNCTION notify_booking_status_change();

-- =============================================
-- 5. INVOICE OVERDUE NOTIFICATION TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION notify_invoice_overdue()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if invoice just became overdue
    IF NEW.due_date < CURRENT_DATE 
    AND NEW.invoice_status = 'pending' 
    AND (OLD.due_date >= CURRENT_DATE OR OLD.invoice_status != 'pending') THEN
        
        INSERT INTO notifications (user_id, title, message, type, read, data, created_at)
        VALUES (
            NEW.customer_id,
            'Invoice Overdue',
            format('Invoice #%s is overdue. Please make payment as soon as possible.', LEFT(NEW.id::text, 8)),
            'invoice_overdue',
            false,
            jsonb_build_object('invoice_id', NEW.id, 'amount', NEW.total, 'due_date', NEW.due_date),
            now()
        );
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN others THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on invoices
DROP TRIGGER IF EXISTS trigger_invoice_overdue ON invoices;
CREATE TRIGGER trigger_invoice_overdue
AFTER UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION notify_invoice_overdue();

-- =============================================
-- 6. AUDIT LOG TRIGGER FOR CRITICAL TABLES
-- =============================================

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

-- Apply audit trigger to critical tables
DROP TRIGGER IF EXISTS trigger_audit_bookings ON bookings;
CREATE TRIGGER trigger_audit_bookings
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW
EXECUTE FUNCTION audit_log_changes();

DROP TRIGGER IF EXISTS trigger_audit_payments ON payments;
CREATE TRIGGER trigger_audit_payments
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION audit_log_changes();

DROP TRIGGER IF EXISTS trigger_audit_invoices ON invoices;
CREATE TRIGGER trigger_audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW
EXECUTE FUNCTION audit_log_changes();

-- =============================================
-- 7. PREVENT DELETION OF ACTIVE BOOKINGS
-- =============================================

CREATE OR REPLACE FUNCTION prevent_active_booking_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.booking_status IN ('active', 'confirmed', 'pending') THEN
        RAISE EXCEPTION 'Cannot delete booking with status: %. Please cancel first.', OLD.booking_status;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_booking_delete ON bookings;
CREATE TRIGGER trigger_prevent_booking_delete
BEFORE DELETE ON bookings
FOR EACH ROW
EXECUTE FUNCTION prevent_active_booking_deletion();

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON FUNCTION update_updated_at_column() IS 
'Generic function to automatically update updated_at timestamp on row update';

COMMENT ON FUNCTION update_warehouse_capacity() IS 
'Automatically recalculates warehouse available capacity when bookings change';

COMMENT ON FUNCTION update_customer_stock_levels() IS 
'Maintains customer_stock_levels table when inventory changes';

COMMENT ON FUNCTION notify_booking_status_change() IS 
'Creates notification when booking status changes';

COMMENT ON FUNCTION audit_log_changes() IS 
'Records all changes to critical tables in audit_logs';
