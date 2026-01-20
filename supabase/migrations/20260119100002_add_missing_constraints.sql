-- Migration: Add Missing Constraints
-- Description: Add unique constraints, check constraints, and fix FK behaviors
-- Run this AFTER index migrations

-- =============================================
-- UNIQUE CONSTRAINTS
-- =============================================

-- Warehouse staff: Same user shouldn't be added twice to same warehouse
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_warehouse_staff_warehouse_user'
    ) THEN
        -- First, remove any duplicates
        DELETE FROM warehouse_staff a USING warehouse_staff b
        WHERE a.id > b.id 
        AND a.warehouse_id = b.warehouse_id 
        AND a.user_id = b.user_id;
        
        ALTER TABLE warehouse_staff 
        ADD CONSTRAINT uq_warehouse_staff_warehouse_user 
        UNIQUE (warehouse_id, user_id);
    END IF;
END $$;

-- Company members: Same user shouldn't be added twice to same company
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_company_members_company_user'
    ) THEN
        -- First, remove any duplicates
        DELETE FROM company_members a USING company_members b
        WHERE a.id > b.id 
        AND a.company_id = b.company_id 
        AND a.user_id = b.user_id;
        
        ALTER TABLE company_members 
        ADD CONSTRAINT uq_company_members_company_user 
        UNIQUE (company_id, user_id);
    END IF;
END $$;

-- Warehouse availability: No duplicate entries for same warehouse/zone/date
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_warehouse_availability_warehouse_zone_date'
    ) THEN
        -- Remove duplicates keeping the latest
        DELETE FROM warehouse_availability a USING warehouse_availability b
        WHERE a.id > b.id 
        AND a.warehouse_id = b.warehouse_id 
        AND COALESCE(a.zone_id::text, '') = COALESCE(b.zone_id::text, '')
        AND a.date = b.date;
        
        ALTER TABLE warehouse_availability 
        ADD CONSTRAINT uq_warehouse_availability_warehouse_zone_date 
        UNIQUE (warehouse_id, zone_id, date);
    END IF;
END $$;

-- =============================================
-- CHECK CONSTRAINTS
-- =============================================

-- Bookings: end_date must be >= start_date (or null for ongoing)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookings_dates'
    ) THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT chk_bookings_dates 
        CHECK (end_date IS NULL OR end_date >= start_date);
    END IF;
END $$;

-- Warehouse pallet height pricing: max must be > min
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_pallet_height_range'
    ) THEN
        ALTER TABLE warehouse_pallet_height_pricing 
        ADD CONSTRAINT chk_pallet_height_range 
        CHECK (height_max_cm > height_min_cm);
    END IF;
END $$;

-- Warehouse pallet weight pricing: max must be > min
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_pallet_weight_range'
    ) THEN
        ALTER TABLE warehouse_pallet_weight_pricing 
        ADD CONSTRAINT chk_pallet_weight_range 
        CHECK (weight_max_kg > weight_min_kg);
    END IF;
END $$;

-- Payments: credit balance used must not exceed amount
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_credit_balance'
    ) THEN
        ALTER TABLE payments 
        ADD CONSTRAINT chk_payments_credit_balance 
        CHECK (credit_balance_used IS NULL OR credit_balance_used <= amount);
    END IF;
END $$;

-- Warehouse availability: available must be >= 0
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_availability_positive'
    ) THEN
        ALTER TABLE warehouse_availability 
        ADD CONSTRAINT chk_availability_positive 
        CHECK (available_pallet_slots >= 0);
    END IF;
END $$;

-- Invoices: amounts must be positive
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_amounts'
    ) THEN
        ALTER TABLE invoices 
        ADD CONSTRAINT chk_invoices_amounts 
        CHECK (total >= 0 AND subtotal >= 0 AND tax >= 0);
    END IF;
END $$;

-- Warehouses: capacity must be positive
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_warehouses_capacity'
    ) THEN
        ALTER TABLE warehouses 
        ADD CONSTRAINT chk_warehouses_capacity 
        CHECK (
            (total_sq_ft IS NULL OR total_sq_ft >= 0) AND
            (total_pallet_storage IS NULL OR total_pallet_storage >= 0) AND
            (available_sq_ft IS NULL OR available_sq_ft >= 0) AND
            (available_pallet_storage IS NULL OR available_pallet_storage >= 0)
        );
    END IF;
END $$;

-- =============================================
-- NOT NULL CONSTRAINTS (where appropriate)
-- =============================================

-- Bookings must have a customer
DO $$ 
BEGIN
    ALTER TABLE bookings ALTER COLUMN customer_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Bookings must have a warehouse
DO $$ 
BEGIN
    ALTER TABLE bookings ALTER COLUMN warehouse_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Invoices must have a customer
DO $$ 
BEGIN
    ALTER TABLE invoices ALTER COLUMN customer_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- =============================================
-- FOREIGN KEY ON DELETE BEHAVIORS
-- =============================================

-- Note: Changing FK behavior requires dropping and recreating the constraint
-- We'll use RESTRICT for soft-delete tables to prevent accidental data loss

-- booking_services -> bookings: CASCADE (if booking deleted, services go too)
DO $$
BEGIN
    -- Check if constraint exists and has wrong behavior
    IF EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'booking_services_booking_id_fkey'
        AND delete_rule != 'CASCADE'
    ) THEN
        ALTER TABLE booking_services DROP CONSTRAINT IF EXISTS booking_services_booking_id_fkey;
        ALTER TABLE booking_services 
        ADD CONSTRAINT booking_services_booking_id_fkey 
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
    END IF;
END $$;

-- inventory_movements -> inventory_items: CASCADE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'inventory_movements_inventory_item_id_fkey'
        AND delete_rule != 'CASCADE'
    ) THEN
        ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_inventory_item_id_fkey;
        ALTER TABLE inventory_movements 
        ADD CONSTRAINT inventory_movements_inventory_item_id_fkey 
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- DEFAULT VALUES
-- =============================================

-- Ensure critical timestamp columns have defaults
ALTER TABLE bookings ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE bookings ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE invoices ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE inventory_items ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE inventory_items ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE notifications ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE notifications ALTER COLUMN read SET DEFAULT false;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON CONSTRAINT uq_warehouse_staff_warehouse_user ON warehouse_staff IS 
'Ensures a user can only be staff member of a warehouse once';

COMMENT ON CONSTRAINT uq_company_members_company_user ON company_members IS 
'Ensures a user can only be member of a company once';

COMMENT ON CONSTRAINT chk_bookings_dates ON bookings IS 
'Ensures end_date is after or equal to start_date, or null for ongoing bookings';

COMMENT ON CONSTRAINT chk_pallet_height_range ON warehouse_pallet_height_pricing IS 
'Ensures maximum height is greater than minimum height';

COMMENT ON CONSTRAINT chk_pallet_weight_range ON warehouse_pallet_weight_pricing IS 
'Ensures maximum weight is greater than minimum weight';
