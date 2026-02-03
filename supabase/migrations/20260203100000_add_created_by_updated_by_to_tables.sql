-- Migration: Add created_by and updated_by to all public tables
-- Purpose: Track who created and who last updated each row (auth.users.id)
-- Tables that already have created_by/updated_by are skipped via IF NOT EXISTS.

-- =============================================
-- 1. TRIGGER FUNCTIONS
-- =============================================

-- Set created_by to current user on INSERT when null
CREATE OR REPLACE FUNCTION public.set_created_by_column()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set updated_by to current user on UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_by_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 2. ADD COLUMNS TO ALL PUBLIC TABLES
-- =============================================

-- Exclude PostGIS/extension tables in public schema (we don't own them)
DO $$
DECLARE
  r RECORD;
  excluded_tables TEXT[] := ARRAY['spatial_ref_sys', 'geography_columns', 'geometry_columns'];
BEGIN
  FOR r IN (
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename != ALL(excluded_tables)
      AND tablename NOT LIKE 'raster%'
  )
  LOOP
    -- Add created_by if not exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tablename AND column_name = 'created_by'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL',
        r.tablename
      );
    END IF;

    -- Add updated_by if not exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tablename AND column_name = 'updated_by'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL',
        r.tablename
      );
    END IF;
  END LOOP;
END $$;

-- =============================================
-- 3. CREATE TRIGGERS FOR created_by (INSERT)
-- =============================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'created_by'
  )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trigger_set_created_by ON public.%I;
       CREATE TRIGGER trigger_set_created_by
         BEFORE INSERT ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION public.set_created_by_column()',
      r.table_name, r.table_name
    );
  END LOOP;
END $$;

-- =============================================
-- 4. CREATE TRIGGERS FOR updated_by (UPDATE)
-- =============================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_by'
  )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trigger_set_updated_by ON public.%I;
       CREATE TRIGGER trigger_set_updated_by
         BEFORE UPDATE ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION public.set_updated_by_column()',
      r.table_name, r.table_name
    );
  END LOOP;
END $$;

-- =============================================
-- 5. INDEXES FOR COMMON QUERIES (optional)
-- =============================================

-- Add indexes on created_by / updated_by only for tables that have the column
-- (indexes created per-table in a loop to avoid errors on missing columns)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'created_by'
  )
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(created_by)',
      LEFT('idx_' || r.table_name || '_created_by', 63), r.table_name
    );
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_by'
  )
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(updated_by)',
      LEFT('idx_' || r.table_name || '_updated_by', 63), r.table_name
    );
  END LOOP;
END $$;

COMMENT ON FUNCTION public.set_created_by_column() IS 'Sets created_by to auth.uid() on INSERT when null';
COMMENT ON FUNCTION public.set_updated_by_column() IS 'Sets updated_by to auth.uid() on UPDATE';
