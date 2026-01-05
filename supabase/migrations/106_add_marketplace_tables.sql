-- Migration: Add marketplace tables for reviews, messages, and favorites
-- Created: 2024-12-XX
-- Purpose: Foundation for Faz 2 features (Trust & Communication)

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS warehouse_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Review content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  
  -- Host response
  host_response TEXT,
  host_response_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(booking_id, user_id) -- One review per booking per user
);

-- Indexes for reviews
CREATE INDEX IF NOT EXISTS idx_warehouse_reviews_warehouse_id ON warehouse_reviews(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_reviews_user_id ON warehouse_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_reviews_booking_id ON warehouse_reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_reviews_rating ON warehouse_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_warehouse_reviews_created_at ON warehouse_reviews(created_at DESC);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS warehouse_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Context (optional - for booking-related messages)
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- Message content
  content TEXT NOT NULL,
  attachments TEXT[], -- Array of file URLs
  
  -- Read status
  read_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CHECK (sender_id != receiver_id)
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_conversation_id ON warehouse_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_sender_id ON warehouse_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_receiver_id ON warehouse_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_warehouse_id ON warehouse_messages(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_booking_id ON warehouse_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_created_at ON warehouse_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_read_at ON warehouse_messages(read_at) WHERE read_at IS NULL;

-- Composite index for conversation queries
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_conversation_created ON warehouse_messages(conversation_id, created_at DESC);

-- ============================================
-- FAVORITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS warehouse_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, warehouse_id) -- One favorite per user per warehouse
);

-- Indexes for favorites
CREATE INDEX IF NOT EXISTS idx_warehouse_favorites_user_id ON warehouse_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_favorites_warehouse_id ON warehouse_favorites(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_favorites_created_at ON warehouse_favorites(created_at DESC);

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

-- Update updated_at for reviews
CREATE OR REPLACE FUNCTION update_warehouse_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_warehouse_reviews_updated_at
  BEFORE UPDATE ON warehouse_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_warehouse_reviews_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE warehouse_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_favorites ENABLE ROW LEVEL SECURITY;

-- Reviews policies
-- Users can view all reviews for a warehouse
CREATE POLICY "Anyone can view warehouse reviews"
  ON warehouse_reviews FOR SELECT
  USING (true);

-- Users can create reviews for their own bookings
CREATE POLICY "Users can create reviews for their bookings"
  ON warehouse_reviews FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = warehouse_reviews.booking_id
      AND bookings.customer_id = auth.uid()
    )
  );

-- Users can update their own reviews
CREATE POLICY "Users can update their own reviews"
  ON warehouse_reviews FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Hosts can respond to reviews for their warehouses
CREATE POLICY "Hosts can respond to reviews"
  ON warehouse_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM warehouses
      WHERE warehouses.id = warehouse_reviews.warehouse_id
      AND warehouses.company_id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid()
        AND role IN ('warehouse_owner', 'company_admin')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warehouses
      WHERE warehouses.id = warehouse_reviews.warehouse_id
      AND warehouses.company_id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid()
        AND role IN ('warehouse_owner', 'company_admin')
      )
    )
  );

-- Messages policies
-- Users can view messages they sent or received
CREATE POLICY "Users can view their messages"
  ON warehouse_messages FOR SELECT
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON warehouse_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Users can update read status of messages they received
CREATE POLICY "Users can mark their received messages as read"
  ON warehouse_messages FOR UPDATE
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

-- Favorites policies
-- Users can view their own favorites
CREATE POLICY "Users can view their favorites"
  ON warehouse_favorites FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own favorites
CREATE POLICY "Users can create favorites"
  ON warehouse_favorites FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own favorites
CREATE POLICY "Users can delete their favorites"
  ON warehouse_favorites FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE warehouse_reviews IS 'Reviews and ratings for warehouse listings';
COMMENT ON TABLE warehouse_messages IS 'Messages between hosts and guests';
COMMENT ON TABLE warehouse_favorites IS 'User favorites/wishlist for warehouses';

COMMENT ON COLUMN warehouse_reviews.rating IS 'Rating from 1 to 5 stars';
COMMENT ON COLUMN warehouse_messages.conversation_id IS 'Groups messages in a conversation thread';
COMMENT ON COLUMN warehouse_messages.attachments IS 'Array of file URLs for message attachments';

