-- Update booking IDs from UUID to short format
-- Format: {CITY_CODE}-{DATE_CODE}-{TYPE}-{RANDOM}
-- Example: NY-315-ARE-A3B7

-- Step 0: Drop RLS policies that depend on bookings.id column
DO $$
BEGIN
  -- Drop policies on booking_usage_periods that reference bookings.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_usage_periods') THEN
    DROP POLICY IF EXISTS "Customers can view own usage" ON booking_usage_periods;
    DROP POLICY IF EXISTS "Warehouse owners can view usage" ON booking_usage_periods;
  END IF;
  
  -- Drop policies on booking_modifications that reference bookings.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_modifications') THEN
    DROP POLICY IF EXISTS "Customers can view own modifications" ON booking_modifications;
    DROP POLICY IF EXISTS "Warehouse owners can manage modifications" ON booking_modifications;
  END IF;
  
  -- Drop policies on booking_proposals that reference bookings.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_proposals') THEN
    DROP POLICY IF EXISTS "Warehouse owners can create proposals" ON booking_proposals;
    DROP POLICY IF EXISTS "Customers can manage own proposals" ON booking_proposals;
    DROP POLICY IF EXISTS "Warehouse owners can view proposals" ON booking_proposals;
  END IF;
END $$;

-- Step 1: Drop foreign key constraints temporarily (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_modifications') THEN
    ALTER TABLE booking_modifications DROP CONSTRAINT IF EXISTS booking_modifications_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_tracking') THEN
    ALTER TABLE usage_tracking DROP CONSTRAINT IF EXISTS usage_tracking_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_services') THEN
    ALTER TABLE booking_services DROP CONSTRAINT IF EXISTS booking_services_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'access_logs') THEN
    ALTER TABLE access_logs DROP CONSTRAINT IF EXISTS access_logs_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items') THEN
    ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claims') THEN
    ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_usage_periods') THEN
    ALTER TABLE booking_usage_periods DROP CONSTRAINT IF EXISTS booking_usage_periods_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_proposals') THEN
    ALTER TABLE booking_proposals DROP CONSTRAINT IF EXISTS booking_proposals_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'incidents') THEN
    ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_affected_booking_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_orders') THEN
    ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_booking_id_fkey;
  END IF;
END $$;

-- Step 2: Change the id column type from UUID to TEXT
ALTER TABLE bookings ALTER COLUMN id TYPE TEXT;

-- Step 3: Update foreign key columns to TEXT (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    ALTER TABLE invoices ALTER COLUMN booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_modifications') THEN
    ALTER TABLE booking_modifications ALTER COLUMN booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_tracking') THEN
    ALTER TABLE usage_tracking ALTER COLUMN booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_services') THEN
    ALTER TABLE booking_services ALTER COLUMN booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'access_logs') THEN
    ALTER TABLE access_logs ALTER COLUMN booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    ALTER TABLE orders ALTER COLUMN booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items') THEN
    ALTER TABLE inventory_items ALTER COLUMN booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claims') THEN
    ALTER TABLE claims ALTER COLUMN booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_usage_periods') THEN
    ALTER TABLE booking_usage_periods ALTER COLUMN booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_proposals') THEN
    ALTER TABLE booking_proposals ALTER COLUMN booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    ALTER TABLE tasks ALTER COLUMN booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'incidents') THEN
    ALTER TABLE incidents ALTER COLUMN affected_booking_id TYPE TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_orders') THEN
    ALTER TABLE service_orders ALTER COLUMN booking_id TYPE TEXT;
  END IF;
END $$;

-- Step 4: Remove the default UUID generation
ALTER TABLE bookings ALTER COLUMN id DROP DEFAULT;

-- Update all existing bookings with new short IDs
-- This function will be called for each booking
DO $$
DECLARE
  booking_record RECORD;
  new_id TEXT;
  city_code TEXT;
  date_code TEXT;
  type_code TEXT;
  random_code TEXT;
  city_name TEXT;
  start_date DATE;
  end_date DATE;
  booking_type TEXT;
  start_day_of_year INTEGER;
  end_day_of_year INTEGER;
  start_year INTEGER;
  end_year INTEGER;
  start_of_year DATE;
  end_of_year DATE;
BEGIN
  -- Loop through all bookings
  FOR booking_record IN 
    SELECT 
      b.id as old_id,
      b.start_date,
      b.end_date,
      b.type,
      w.city
    FROM bookings b
    LEFT JOIN warehouses w ON b.warehouse_id = w.id
    WHERE b.status = true
  LOOP
    -- Get city name
    city_name := COALESCE(booking_record.city, 'UNK');
    
    -- City code mapping
    CASE LOWER(TRIM(city_name))
      WHEN 'new york' THEN city_code := 'NY';
      WHEN 'los angeles' THEN city_code := 'LA';
      WHEN 'chicago' THEN city_code := 'CHI';
      WHEN 'houston' THEN city_code := 'HOU';
      WHEN 'phoenix' THEN city_code := 'PHX';
      WHEN 'philadelphia' THEN city_code := 'PHL';
      WHEN 'san antonio' THEN city_code := 'SA';
      WHEN 'san diego' THEN city_code := 'SD';
      WHEN 'dallas' THEN city_code := 'DAL';
      WHEN 'san jose' THEN city_code := 'SJ';
      WHEN 'austin' THEN city_code := 'AUS';
      WHEN 'jacksonville' THEN city_code := 'JAX';
      WHEN 'san francisco' THEN city_code := 'SF';
      WHEN 'columbus' THEN city_code := 'COL';
      WHEN 'fort worth' THEN city_code := 'FW';
      WHEN 'charlotte' THEN city_code := 'CLT';
      WHEN 'detroit' THEN city_code := 'DET';
      WHEN 'el paso' THEN city_code := 'EP';
      WHEN 'seattle' THEN city_code := 'SEA';
      WHEN 'denver' THEN city_code := 'DEN';
      WHEN 'washington' THEN city_code := 'DC';
      WHEN 'memphis' THEN city_code := 'MEM';
      WHEN 'boston' THEN city_code := 'BOS';
      WHEN 'nashville' THEN city_code := 'NSH';
      WHEN 'portland' THEN city_code := 'PDX';
      WHEN 'oklahoma city' THEN city_code := 'OKC';
      WHEN 'las vegas' THEN city_code := 'LV';
      WHEN 'baltimore' THEN city_code := 'BAL';
      WHEN 'milwaukee' THEN city_code := 'MIL';
      WHEN 'albuquerque' THEN city_code := 'ABQ';
      WHEN 'tucson' THEN city_code := 'TUC';
      WHEN 'fresno' THEN city_code := 'FRE';
      WHEN 'sacramento' THEN city_code := 'SAC';
      WHEN 'kansas city' THEN city_code := 'KC';
      WHEN 'mesa' THEN city_code := 'MES';
      WHEN 'atlanta' THEN city_code := 'ATL';
      WHEN 'omaha' THEN city_code := 'OMA';
      WHEN 'colorado springs' THEN city_code := 'COS';
      WHEN 'raleigh' THEN city_code := 'RAL';
      WHEN 'virginia beach' THEN city_code := 'VB';
      WHEN 'miami' THEN city_code := 'MIA';
      WHEN 'oakland' THEN city_code := 'OAK';
      WHEN 'minneapolis' THEN city_code := 'MIN';
      WHEN 'tulsa' THEN city_code := 'TUL';
      WHEN 'cleveland' THEN city_code := 'CLE';
      WHEN 'wichita' THEN city_code := 'WIC';
      WHEN 'arlington' THEN city_code := 'ARL';
      WHEN 'elizabeth' THEN city_code := 'ELZ';
      WHEN 'newark' THEN city_code := 'NWK';
      WHEN 'jersey city' THEN city_code := 'JC';
      ELSE city_code := UPPER(SUBSTRING(TRIM(city_name), 1, 3));
    END CASE;
    
    -- Get booking type code
    IF booking_record.type = 'area-rental' THEN
      type_code := 'ARE';
    ELSE
      type_code := 'PAL';
    END IF;
    
    -- Calculate date code
    start_date := booking_record.start_date;
    end_date := COALESCE(booking_record.end_date, start_date);
    
    start_year := EXTRACT(YEAR FROM start_date);
    start_of_year := DATE_TRUNC('year', start_date::DATE);
    start_day_of_year := EXTRACT(DOY FROM start_date)::INTEGER;
    
    end_year := EXTRACT(YEAR FROM end_date);
    end_of_year := DATE_TRUNC('year', end_date::DATE);
    end_day_of_year := EXTRACT(DOY FROM end_date)::INTEGER;
    
    IF start_year = end_year THEN
      date_code := LPAD(start_day_of_year::TEXT, 3, '0') || SUBSTRING(end_day_of_year::TEXT, -2);
    ELSE
      date_code := LPAD(start_day_of_year::TEXT, 3, '0') || LPAD(end_day_of_year::TEXT, 3, '0');
    END IF;
    
    -- Generate random code (4 alphanumeric characters, excluding confusing ones)
    random_code := UPPER(
      SUBSTRING(
        MD5(booking_record.old_id || NOW()::TEXT || RANDOM()::TEXT),
        1, 4
      )
    );
    -- Replace confusing characters
    random_code := REPLACE(REPLACE(REPLACE(REPLACE(random_code, '0', '2'), 'O', 'Q'), 'I', 'J'), '1', '3');
    
    -- Construct new ID
    new_id := city_code || '-' || date_code || '-' || type_code || '-' || random_code;
    
    -- Update the booking ID and all foreign key references
    -- Use dynamic SQL to handle tables that may not exist
    BEGIN
      UPDATE invoices SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE booking_modifications SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE usage_tracking SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE booking_services SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE access_logs SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE orders SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE inventory_items SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE claims SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE booking_usage_periods SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE booking_proposals SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE tasks SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE incidents SET affected_booking_id = new_id WHERE affected_booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    BEGIN
      UPDATE service_orders SET booking_id = new_id WHERE booking_id = booking_record.old_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    
    -- Finally update the booking itself
    UPDATE bookings SET id = new_id WHERE id = booking_record.old_id;
    
  END LOOP;
END $$;

-- Step 5: Recreate foreign key constraints (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_modifications') THEN
    ALTER TABLE booking_modifications ADD CONSTRAINT booking_modifications_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_tracking') THEN
    ALTER TABLE usage_tracking ADD CONSTRAINT usage_tracking_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_services') THEN
    ALTER TABLE booking_services ADD CONSTRAINT booking_services_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'access_logs') THEN
    ALTER TABLE access_logs ADD CONSTRAINT access_logs_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items') THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claims') THEN
    ALTER TABLE claims ADD CONSTRAINT claims_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_usage_periods') THEN
    ALTER TABLE booking_usage_periods ADD CONSTRAINT booking_usage_periods_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_proposals') THEN
    ALTER TABLE booking_proposals ADD CONSTRAINT booking_proposals_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'incidents') THEN
    ALTER TABLE incidents ADD CONSTRAINT incidents_affected_booking_id_fkey 
      FOREIGN KEY (affected_booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_orders') THEN
    ALTER TABLE service_orders ADD CONSTRAINT service_orders_booking_id_fkey 
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 6: Recreate RLS policies that were dropped
DO $$
BEGIN
  -- Recreate policies on booking_usage_periods
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_usage_periods') THEN
    -- Customers can view usage for their bookings
    CREATE POLICY "Customers can view own usage"
      ON booking_usage_periods FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM bookings
          WHERE bookings.id = booking_usage_periods.booking_id
          AND bookings.customer_id = auth.uid()
        )
      );

    -- Warehouse owners can view usage for their warehouses
    CREATE POLICY "Warehouse owners can view usage"
      ON booking_usage_periods FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM bookings
          JOIN warehouses ON warehouses.id = bookings.warehouse_id
          WHERE bookings.id = booking_usage_periods.booking_id
          AND warehouses.owner_company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
          )
        )
      );
  END IF;
  
  -- Recreate policies on booking_modifications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_modifications') THEN
    -- Customers can view modifications for their bookings
    CREATE POLICY "Customers can view own modifications"
      ON booking_modifications FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM bookings
          WHERE bookings.id = booking_modifications.booking_id
          AND bookings.customer_id = auth.uid()
        )
      );

    -- Warehouse owners can manage modifications for their warehouses
    CREATE POLICY "Warehouse owners can manage modifications"
      ON booking_modifications FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM bookings
          JOIN warehouses ON warehouses.id = bookings.warehouse_id
          WHERE bookings.id = booking_modifications.booking_id
          AND warehouses.owner_company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
          )
        )
      );
  END IF;
  
  -- Recreate policies on booking_proposals
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_proposals') THEN
    -- Warehouse owners can create proposals
    CREATE POLICY "Warehouse owners can create proposals"
      ON booking_proposals FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM bookings
          JOIN warehouses ON warehouses.id = bookings.warehouse_id
          WHERE bookings.id = booking_proposals.booking_id
          AND warehouses.owner_company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
          )
        )
      );

    -- Customers can view and update proposals for their bookings
    CREATE POLICY "Customers can manage own proposals"
      ON booking_proposals FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM bookings
          WHERE bookings.id = booking_proposals.booking_id
          AND bookings.customer_id = auth.uid()
        )
      );

    -- Warehouse owners can view proposals for their warehouses
    CREATE POLICY "Warehouse owners can view proposals"
      ON booking_proposals FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM bookings
          JOIN warehouses ON warehouses.id = bookings.warehouse_id
          WHERE bookings.id = booking_proposals.booking_id
          AND warehouses.owner_company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Add constraint to ensure ID format (optional, for validation)
-- ALTER TABLE bookings ADD CONSTRAINT bookings_id_format 
--   CHECK (id ~ '^[A-Z]{2,3}-[0-9]{3,6}-(ARE|PAL)-[A-Z0-9]{4}$');

-- Add comment
COMMENT ON COLUMN bookings.id IS 'Short booking ID format: {CITY_CODE}-{DATE_CODE}-{TYPE}-{RANDOM}';

