-- Migration 107: PostGIS + Enhanced Marketplace Tables
-- Created: 2024-12-XX
-- Purpose: Enable geographic search with PostGIS and enhance marketplace features
-- 
-- This migration:
-- 1. Enables PostGIS extension for geographic queries
-- 2. Adds location geography column to warehouses
-- 3. Enhances existing review/message/favorite tables from migration 106
-- 4. Adds availability calendar, inquiries, platform settings, and payouts
-- 5. Creates geographic search function
-- 6. Creates warehouse_listings view

-- =====================================================
-- PART 1: POSTGIS SETUP FOR GEOGRAPHIC SEARCH
-- =====================================================

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography column to warehouses (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'warehouses' 
    AND column_name = 'location'
  ) THEN
    ALTER TABLE public.warehouses ADD COLUMN location geography(POINT, 4326);
  END IF;
END $$;

-- Populate location from existing lat/lng
UPDATE public.warehouses 
SET location = ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL 
  AND location IS NULL
  AND latitude::text != ''
  AND longitude::text != '';

-- Create spatial index for fast geographic queries
CREATE INDEX IF NOT EXISTS idx_warehouses_location_gist 
ON public.warehouses USING GIST (location)
WHERE location IS NOT NULL;

-- Function to auto-update location when lat/lng changes
CREATE OR REPLACE FUNCTION update_warehouse_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL 
     AND NEW.latitude::text != '' AND NEW.longitude::text != '' THEN
    NEW.location = ST_SetSRID(
      ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 
      4326
    )::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call function on insert/update
DROP TRIGGER IF EXISTS trigger_update_warehouse_location ON public.warehouses;
CREATE TRIGGER trigger_update_warehouse_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION update_warehouse_location();

-- Full-text search index for name, address, city
CREATE INDEX IF NOT EXISTS idx_warehouses_fulltext 
ON public.warehouses USING GIN (
  to_tsvector('english', 
    COALESCE(name, '') || ' ' || 
    COALESCE(address, '') || ' ' || 
    COALESCE(city, '')
  )
);

-- =====================================================
-- PART 2: ENHANCED REVIEWS SYSTEM
-- =====================================================

-- Create warehouse_reviews table if it doesn't exist (from migration 106)
CREATE TABLE IF NOT EXISTS public.warehouse_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  host_response TEXT,
  host_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, user_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_warehouse_reviews_warehouse_id ON warehouse_reviews(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_reviews_user_id ON warehouse_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_reviews_booking_id ON warehouse_reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_reviews_rating ON warehouse_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_warehouse_reviews_created_at ON warehouse_reviews(created_at DESC);

-- Add detailed rating columns to existing warehouse_reviews table
ALTER TABLE public.warehouse_reviews
ADD COLUMN IF NOT EXISTS communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS accuracy_rating INTEGER CHECK (accuracy_rating BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS location_rating INTEGER CHECK (location_rating BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS value_rating INTEGER CHECK (value_rating BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS cleanliness_rating INTEGER CHECK (cleanliness_rating BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS pros TEXT[],
ADD COLUMN IF NOT EXISTS cons TEXT[],
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_type TEXT DEFAULT 'guest_to_host' CHECK (review_type IN ('guest_to_host', 'host_to_guest')),
  ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true;

-- Add reviewee_id for host reviews
ALTER TABLE public.warehouse_reviews
ADD COLUMN IF NOT EXISTS reviewee_id UUID REFERENCES profiles(id);

-- Update reviewee_id for existing reviews (set to warehouse owner)
UPDATE public.warehouse_reviews wr
SET reviewee_id = (
  SELECT w.owner_company_id 
  FROM warehouses w 
  WHERE w.id = wr.warehouse_id
  LIMIT 1
)
WHERE reviewee_id IS NULL;

-- Review summary cache table (denormalized for performance)
CREATE TABLE IF NOT EXISTS public.warehouse_review_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL UNIQUE REFERENCES warehouses(id) ON DELETE CASCADE,
  total_reviews INTEGER DEFAULT 0,
  average_rating NUMERIC(3,2) DEFAULT 0,
  average_communication NUMERIC(3,2) DEFAULT 0,
  average_accuracy NUMERIC(3,2) DEFAULT 0,
  average_location NUMERIC(3,2) DEFAULT 0,
  average_value NUMERIC(3,2) DEFAULT 0,
  average_cleanliness NUMERIC(3,2) DEFAULT 0,
  rating_distribution JSONB DEFAULT '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}'::jsonb,
  last_review_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_review_summary_warehouse_id ON warehouse_review_summary(warehouse_id);

-- Function to update review summary
CREATE OR REPLACE FUNCTION update_review_summary()
RETURNS TRIGGER AS $$
DECLARE
  rating_dist JSONB;
BEGIN
  -- Calculate rating distribution
  SELECT jsonb_object_agg(rating::text, count) INTO rating_dist
  FROM (
    SELECT rating, COUNT(*) as count
    FROM warehouse_reviews
    WHERE warehouse_id = COALESCE(NEW.warehouse_id, OLD.warehouse_id)
      AND (is_published = true OR is_published IS NULL)
      AND (status = true OR status IS NULL)
    GROUP BY rating
  ) subq;

  INSERT INTO warehouse_review_summary (
    warehouse_id, 
    total_reviews, 
    average_rating, 
    average_communication,
    average_accuracy,
    average_location,
    average_value,
    average_cleanliness,
    rating_distribution,
    last_review_at, 
    updated_at
  )
  SELECT 
    COALESCE(NEW.warehouse_id, OLD.warehouse_id),
    COUNT(*),
    ROUND(AVG(rating)::numeric, 2),
    ROUND(AVG(communication_rating)::numeric, 2),
    ROUND(AVG(accuracy_rating)::numeric, 2),
    ROUND(AVG(location_rating)::numeric, 2),
    ROUND(AVG(value_rating)::numeric, 2),
    ROUND(AVG(cleanliness_rating)::numeric, 2),
    COALESCE(rating_dist, '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}'::jsonb),
    MAX(created_at),
    NOW()
  FROM warehouse_reviews
  WHERE warehouse_id = COALESCE(NEW.warehouse_id, OLD.warehouse_id)
    AND (is_published = true OR is_published IS NULL)
    AND (status = true OR status IS NULL)
  ON CONFLICT (warehouse_id) 
  DO UPDATE SET
    total_reviews = EXCLUDED.total_reviews,
    average_rating = EXCLUDED.average_rating,
    average_communication = EXCLUDED.average_communication,
    average_accuracy = EXCLUDED.average_accuracy,
    average_location = EXCLUDED.average_location,
    average_value = EXCLUDED.average_value,
    average_cleanliness = EXCLUDED.average_cleanliness,
    rating_distribution = EXCLUDED.rating_distribution,
    last_review_at = EXCLUDED.last_review_at,
    updated_at = NOW();
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update review summary
DROP TRIGGER IF EXISTS trigger_update_review_summary ON public.warehouse_reviews;
CREATE TRIGGER trigger_update_review_summary
AFTER INSERT OR UPDATE OF is_published, status, rating ON public.warehouse_reviews
FOR EACH ROW
EXECUTE FUNCTION update_review_summary();

-- =====================================================
-- PART 3: ENHANCED MESSAGING SYSTEM
-- =====================================================

-- Create warehouse_messages table if it doesn't exist (from migration 106)
CREATE TABLE IF NOT EXISTS public.warehouse_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  attachments TEXT[],
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (sender_id != receiver_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_conversation_id ON warehouse_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_sender_id ON warehouse_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_receiver_id ON warehouse_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_warehouse_id ON warehouse_messages(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_booking_id ON warehouse_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_created_at ON warehouse_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_read_at ON warehouse_messages(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_conversation_created ON warehouse_messages(conversation_id, created_at DESC);

-- Create conversations table (replaces simple conversation_id in messages)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  inquiry_id UUID,
  
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  subject TEXT,
  conversation_status TEXT NOT NULL DEFAULT 'active' CHECK (conversation_status IN ('active', 'archived', 'blocked')),
  
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  
  host_unread_count INTEGER DEFAULT 0,
  guest_unread_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status BOOLEAN NOT NULL DEFAULT true,
  
  CONSTRAINT conversations_host_guest_check CHECK (host_id != guest_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_host_id ON conversations(host_id);
CREATE INDEX IF NOT EXISTS idx_conversations_guest_id ON conversations(guest_id);
CREATE INDEX IF NOT EXISTS idx_conversations_warehouse_id ON conversations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_conversations_booking_id ON conversations(booking_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC) WHERE conversation_status = 'active';

-- Update existing warehouse_messages to link to conversations
-- First, create conversations for existing messages
INSERT INTO conversations (id, warehouse_id, host_id, guest_id, last_message_at, created_at)
SELECT DISTINCT
  conversation_id,
  COALESCE(warehouse_id, (SELECT id FROM warehouses LIMIT 1)),
  CASE 
    WHEN sender_id IN (SELECT user_id FROM company_members WHERE role IN ('company_owner', 'company_admin'))
    THEN sender_id
    ELSE receiver_id
  END as host_id,
  CASE 
    WHEN sender_id IN (SELECT user_id FROM company_members WHERE role IN ('company_owner', 'company_admin'))
    THEN receiver_id
    ELSE sender_id
  END as guest_id,
  MAX(created_at),
  MIN(created_at)
FROM warehouse_messages
WHERE conversation_id NOT IN (SELECT id FROM conversations)
GROUP BY conversation_id, warehouse_id, sender_id, receiver_id
ON CONFLICT (id) DO NOTHING;

-- Add conversation_id foreign key to messages (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'warehouse_messages_conversation_id_fkey'
  ) THEN
    ALTER TABLE warehouse_messages
    ADD CONSTRAINT warehouse_messages_conversation_id_fkey 
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add message_type and metadata to messages
ALTER TABLE warehouse_messages
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system', 'booking_request', 'booking_update')),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Function to update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
DECLARE
  conv_record RECORD;
BEGIN
  SELECT host_id, guest_id INTO conv_record
  FROM conversations WHERE id = NEW.conversation_id;
  
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW(),
    host_unread_count = CASE 
      WHEN NEW.sender_id = conv_record.guest_id THEN host_unread_count + 1 
      ELSE host_unread_count 
    END,
    guest_unread_count = CASE 
      WHEN NEW.sender_id = conv_record.host_id THEN guest_unread_count + 1 
      ELSE guest_unread_count 
    END
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON warehouse_messages;
CREATE TRIGGER trigger_update_conversation_on_message
AFTER INSERT ON warehouse_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_message();

-- =====================================================
-- PART 4: AVAILABILITY CALENDAR
-- =====================================================

CREATE TABLE IF NOT EXISTS public.warehouse_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES warehouse_zones(id) ON DELETE SET NULL,
  
  date DATE NOT NULL,
  
  -- Pallet availability
  total_pallet_slots INTEGER,
  available_pallet_slots INTEGER,
  reserved_pallet_slots INTEGER DEFAULT 0,
  
  -- Area availability
  total_area_sqft INTEGER,
  available_area_sqft INTEGER,
  reserved_area_sqft INTEGER DEFAULT 0,
  
  -- Price overrides for specific dates
  pallet_price_override NUMERIC(10,2),
  area_price_override NUMERIC(10,2),
  
  -- Blocking
  is_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  
  min_days_override INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT warehouse_availability_unique UNIQUE (warehouse_id, zone_id, date)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_availability_lookup ON warehouse_availability(warehouse_id, date);
CREATE INDEX IF NOT EXISTS idx_warehouse_availability_date_range ON warehouse_availability(warehouse_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_availability_zone ON warehouse_availability(zone_id, date);

-- =====================================================
-- PART 5: INQUIRIES SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  interested_type TEXT CHECK (interested_type IN ('pallet', 'area-rental')),
  interested_quantity INTEGER,
  interested_start_date DATE,
  interested_end_date DATE,
  
  message TEXT NOT NULL,
  
  inquiry_status TEXT NOT NULL DEFAULT 'pending' CHECK (inquiry_status IN ('pending', 'responded', 'converted', 'expired', 'declined')),
  
  responded_at TIMESTAMPTZ,
  converted_booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_inquiries_warehouse_id ON inquiries(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_guest_id ON inquiries(guest_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(inquiry_status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);

-- =====================================================
-- PART 6: PLATFORM SETTINGS & PAYOUTS
-- =====================================================

-- Platform settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('platform_fee_percent', '"10"', 'Platform commission rate (%)'),
  ('min_booking_days', '"1"', 'Minimum booking duration in days'),
  ('max_booking_days', '"365"', 'Maximum booking duration in days'),
  ('payout_delay_days', '"3"', 'Days to wait before payout after booking completion'),
  ('review_window_days', '"14"', 'Days allowed to submit review after booking ends'),
  ('inquiry_expiry_days', '"7"', 'Days before inquiry expires'),
  ('cancellation_policies', '{"flexible": {"refund_percent": 100, "days_before": 1}, "moderate": {"refund_percent": 50, "days_before": 5}, "strict": {"refund_percent": 0, "days_before": 14}}', 'Cancellation policy options')
ON CONFLICT (key) DO NOTHING;

-- Host payouts (for Stripe Connect)
CREATE TABLE IF NOT EXISTS public.host_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  
  gross_amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL,
  net_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  stripe_connected_account_id TEXT,
  
  payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN (
    'pending', 'processing', 'succeeded', 'failed', 'cancelled'
  )),
  
  scheduled_date DATE,
  processed_at TIMESTAMPTZ,
  failed_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_host_payouts_host_id ON host_payouts(host_id);
CREATE INDEX IF NOT EXISTS idx_host_payouts_company_id ON host_payouts(company_id);
CREATE INDEX IF NOT EXISTS idx_host_payouts_booking_id ON host_payouts(booking_id);
CREATE INDEX IF NOT EXISTS idx_host_payouts_status ON host_payouts(payout_status);
CREATE INDEX IF NOT EXISTS idx_host_payouts_scheduled ON host_payouts(scheduled_date) WHERE payout_status = 'pending';

-- Add Stripe Connect columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_connect_status TEXT DEFAULT 'not_connected',
ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS verification_documents JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Add check constraints separately (safer for existing data)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_stripe_connect_status_check'
  ) THEN
    ALTER TABLE public.companies 
    ADD CONSTRAINT companies_stripe_connect_status_check 
    CHECK (stripe_connect_status IN ('not_connected', 'pending', 'active', 'restricted', 'disabled'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_verification_status_check'
  ) THEN
    ALTER TABLE public.companies 
    ADD CONSTRAINT companies_verification_status_check 
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));
  END IF;
END $$;

-- =====================================================
-- PART 7: GEOGRAPHIC SEARCH FUNCTION
-- =====================================================

-- Function for radius-based warehouse search using PostGIS
CREATE OR REPLACE FUNCTION search_warehouses_by_location(
  search_lat double precision,
  search_lng double precision,
  radius_km integer DEFAULT 50,
  warehouse_type_filter text[] DEFAULT NULL,
  storage_type_filter text[] DEFAULT NULL,
  min_pallet_capacity integer DEFAULT NULL,
  min_area_sqft integer DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  city text,
  latitude numeric,
  longitude numeric,
  distance_km double precision,
  total_sq_ft integer,
  available_sq_ft integer,
  total_pallet_storage integer,
  available_pallet_storage integer,
  warehouse_type text,
  storage_type text,
  temperature_types text[],
  amenities text[],
  photos text[],
  owner_company_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.address,
    w.city,
    w.latitude,
    w.longitude,
    ST_Distance(
      w.location, 
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
    ) / 1000.0 as distance_km,
    w.total_sq_ft,
    w.available_sq_ft,
    w.total_pallet_storage,
    w.available_pallet_storage,
    w.warehouse_type,
    w.storage_type,
    w.temperature_types,
    w.amenities,
    w.photos,
    w.owner_company_id
  FROM public.warehouses w
  WHERE 
    w.status = true
    AND w.location IS NOT NULL
    AND ST_DWithin(
      w.location,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
      radius_km * 1000  -- Convert km to meters
    )
    AND (warehouse_type_filter IS NULL OR w.warehouse_type = ANY(warehouse_type_filter))
    AND (storage_type_filter IS NULL OR w.storage_type = ANY(storage_type_filter))
    AND (min_pallet_capacity IS NULL OR w.available_pallet_storage >= min_pallet_capacity)
    AND (min_area_sqft IS NULL OR w.available_sq_ft >= min_area_sqft)
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 8: WAREHOUSE LISTINGS VIEW
-- =====================================================

-- Warehouse listing view with all related data
CREATE OR REPLACE VIEW public.warehouse_listings AS
SELECT 
  w.id,
  w.name,
  w.address,
  w.city,
  NULL as state,
  w.zip_code,
  w.latitude,
  w.longitude,
  w.total_sq_ft,
  w.available_sq_ft,
  w.total_pallet_storage,
  w.available_pallet_storage,
  w.warehouse_type,
  w.storage_type,
  w.temperature_types,
  w.amenities,
  w.photos,
  w.operating_hours,
  w.security,
  w.rent_methods,
  w.warehouse_in_fee,
  w.warehouse_out_fee,
  NULL as description,
  w.owner_company_id,
  c.id as company_id,
  c.name as company_name,
  c.logo_url as company_logo,
  c.verification_status as host_verification,
  COALESCE(rs.average_rating, 0) as average_rating,
  COALESCE(rs.total_reviews, 0) as total_reviews,
  (
    SELECT MIN(base_price::numeric) 
    FROM warehouse_pricing wp 
    WHERE wp.warehouse_id = w.id AND wp.status = true
  ) as min_price,
  (
    SELECT jsonb_agg(jsonb_build_object(
      'type', wp.pricing_type,
      'price', wp.base_price,
      'unit', wp.unit
    ))
    FROM warehouse_pricing wp 
    WHERE wp.warehouse_id = w.id AND wp.status = true
  ) as pricing
FROM warehouses w
LEFT JOIN companies c ON w.owner_company_id = c.id
LEFT JOIN warehouse_review_summary rs ON rs.warehouse_id = w.id
WHERE w.status = true;

-- =====================================================
-- PART 9: ADDITIONAL INDEXES FOR PERFORMANCE
-- =====================================================

-- Reviews indexes (if not exist from migration 106)
CREATE INDEX IF NOT EXISTS idx_reviews_warehouse_id ON public.warehouse_reviews(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON public.warehouse_reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.warehouse_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_published ON public.warehouse_reviews(is_published) WHERE is_published = true;

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_host_id ON public.conversations(host_id);
CREATE INDEX IF NOT EXISTS idx_conversations_guest_id ON public.conversations(guest_id);
CREATE INDEX IF NOT EXISTS idx_conversations_warehouse_id ON public.conversations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- Messages indexes (enhanced)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.warehouse_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.warehouse_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.warehouse_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.warehouse_messages(conversation_id, is_read) WHERE is_read = false;

-- Create warehouse_favorites table if it doesn't exist (from migration 106)
CREATE TABLE IF NOT EXISTS public.warehouse_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, warehouse_id)
);

-- Favorites indexes (if not exist from migration 106)
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.warehouse_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_warehouse_id ON public.warehouse_favorites(warehouse_id);

-- Inquiries indexes
CREATE INDEX IF NOT EXISTS idx_inquiries_warehouse_id ON public.inquiries(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_guest_id ON public.inquiries(guest_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(inquiry_status);

-- Availability indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_availability_lookup ON public.warehouse_availability(warehouse_id, date);
CREATE INDEX IF NOT EXISTS idx_warehouse_availability_date_range ON public.warehouse_availability(warehouse_id, date DESC);

-- Payouts indexes
CREATE INDEX IF NOT EXISTS idx_host_payouts_host_id ON public.host_payouts(host_id);
CREATE INDEX IF NOT EXISTS idx_host_payouts_company_id ON public.host_payouts(company_id);
CREATE INDEX IF NOT EXISTS idx_host_payouts_status ON public.host_payouts(payout_status);
CREATE INDEX IF NOT EXISTS idx_host_payouts_scheduled ON public.host_payouts(scheduled_date) WHERE payout_status = 'pending';

-- =====================================================
-- PART 10: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE warehouse_review_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_payouts ENABLE ROW LEVEL SECURITY;

-- Review summary policies (public read)
CREATE POLICY "Anyone can view review summaries"
  ON warehouse_review_summary FOR SELECT
  USING (true);

-- Conversations policies
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  USING (host_id = auth.uid() OR guest_id = auth.uid());

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (host_id = auth.uid() OR guest_id = auth.uid());

CREATE POLICY "Users can update their conversations"
  ON conversations FOR UPDATE
  USING (host_id = auth.uid() OR guest_id = auth.uid())
  WITH CHECK (host_id = auth.uid() OR guest_id = auth.uid());

-- Availability policies (public read for search, hosts can manage)
CREATE POLICY "Anyone can view warehouse availability"
  ON warehouse_availability FOR SELECT
  USING (true);

CREATE POLICY "Hosts can manage availability"
  ON warehouse_availability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM warehouses w
      WHERE w.id = warehouse_availability.warehouse_id
      AND w.owner_company_id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid()
        AND role IN ('company_owner', 'company_admin')
      )
    )
  );

-- Inquiries policies
CREATE POLICY "Anyone can view inquiries for a warehouse"
  ON inquiries FOR SELECT
  USING (true);

CREATE POLICY "Guests can create inquiries"
  ON inquiries FOR INSERT
  WITH CHECK (guest_id = auth.uid());

CREATE POLICY "Hosts can update inquiries for their warehouses"
  ON inquiries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM warehouses w
      WHERE w.id = inquiries.warehouse_id
      AND w.owner_company_id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid()
        AND role IN ('company_owner', 'company_admin')
      )
    )
  );

-- Platform settings policies (admin only)
CREATE POLICY "Admins can manage platform settings"
  ON platform_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'root'
    )
  );

-- Payouts policies
CREATE POLICY "Hosts can view their payouts"
  ON host_payouts FOR SELECT
  USING (host_id = auth.uid());

CREATE POLICY "Admins can manage all payouts"
  ON host_payouts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'root'
    )
  );

-- =====================================================
-- PART 11: COMMENTS
-- =====================================================

COMMENT ON TABLE warehouse_review_summary IS 'Cached review summaries for fast queries';
COMMENT ON TABLE conversations IS 'Conversation threads between hosts and guests';
COMMENT ON TABLE warehouse_availability IS 'Date-based availability calendar for warehouses';
COMMENT ON TABLE inquiries IS 'Pre-booking inquiries from guests to hosts';
COMMENT ON TABLE platform_settings IS 'Platform-wide configuration settings';
COMMENT ON TABLE host_payouts IS 'Host payout records for Stripe Connect';

COMMENT ON FUNCTION search_warehouses_by_location IS 'PostGIS function for geographic warehouse search within radius';
COMMENT ON VIEW warehouse_listings IS 'Denormalized view of warehouses with company, pricing, and review data';

