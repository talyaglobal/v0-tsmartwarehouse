-- Create Appointments System
-- Migration: 074_create_appointments_system
-- Creates appointment types, appointments, and appointment participants tables

-- ============================================
-- APPOINTMENT TYPES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS appointment_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6', -- Default blue
  icon TEXT, -- Icon name/identifier
  duration_minutes INTEGER NOT NULL DEFAULT 60, -- Default 1 hour
  requires_warehouse_staff BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for appointment_types
CREATE INDEX IF NOT EXISTS idx_appointment_types_slug ON appointment_types(slug);
CREATE INDEX IF NOT EXISTS idx_appointment_types_is_active ON appointment_types(is_active);
CREATE INDEX IF NOT EXISTS idx_appointment_types_created_by ON appointment_types(created_by);

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  appointment_type_id UUID NOT NULL REFERENCES appointment_types(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')) DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  location TEXT, -- Physical location for in-person appointments
  meeting_link TEXT, -- For online meetings
  phone_number TEXT, -- For phone meetings
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT end_time_after_start_time CHECK (end_time > start_time)
);

-- Create indexes for appointments
CREATE INDEX IF NOT EXISTS idx_appointments_warehouse_id ON appointments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_type_id ON appointments(appointment_type_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_created_by ON appointments(created_by);
CREATE INDEX IF NOT EXISTS idx_appointments_date_range ON appointments(start_time, end_time);

-- ============================================
-- APPOINTMENT PARTICIPANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS appointment_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('requester', 'attendee', 'staff_assignee')) DEFAULT 'attendee',
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id, user_id) -- Prevent duplicate participants
);

-- Create indexes for appointment_participants
CREATE INDEX IF NOT EXISTS idx_appointment_participants_appointment_id ON appointment_participants(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_participants_user_id ON appointment_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_appointment_participants_status ON appointment_participants(status);

-- ============================================
-- TRIGGERS
-- ============================================
-- Update updated_at timestamp for appointment_types
CREATE TRIGGER update_appointment_types_updated_at
  BEFORE UPDATE ON appointment_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update updated_at timestamp for appointments
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_participants ENABLE ROW LEVEL SECURITY;

-- Appointment Types Policies
-- Anyone can view active appointment types
CREATE POLICY "Anyone can view active appointment types"
  ON appointment_types FOR SELECT
  USING (is_active = true);

-- Only root admin can create appointment types
CREATE POLICY "Root admin can create appointment types"
  ON appointment_types FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'root'
    )
  );

-- Only root admin can update appointment types
CREATE POLICY "Root admin can update appointment types"
  ON appointment_types FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'root'
    )
  );

-- Only root admin can delete appointment types (soft delete via is_active)
CREATE POLICY "Root admin can delete appointment types"
  ON appointment_types FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'root'
    )
  );

-- Appointments Policies
-- Users can view appointments for warehouses they have access to
-- (warehouse staff, company members, or participants)
CREATE POLICY "Users can view accessible appointments"
  ON appointments FOR SELECT
  USING (
    -- User is a participant
    EXISTS (
      SELECT 1 FROM appointment_participants
      WHERE appointment_participants.appointment_id = appointments.id
      AND appointment_participants.user_id = auth.uid()
    )
    OR
    -- User created the appointment
    created_by = auth.uid()
    OR
    -- User is warehouse staff for this warehouse
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'warehouse_staff'
      AND EXISTS (
        SELECT 1 FROM warehouses
        WHERE warehouses.id = appointments.warehouse_id
        -- Add warehouse ownership check if needed
      )
    )
    OR
    -- User is root admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'root'
    )
  );

-- Authenticated users can create appointments
CREATE POLICY "Authenticated users can create appointments"
  ON appointments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update appointments they created or are warehouse staff
CREATE POLICY "Users can update their appointments"
  ON appointments FOR UPDATE
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('warehouse_staff', 'root')
    )
  );

-- Users can delete (cancel) appointments they created or are warehouse staff
CREATE POLICY "Users can cancel their appointments"
  ON appointments FOR DELETE
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('warehouse_staff', 'root')
    )
  );

-- Appointment Participants Policies
-- Users can view participants for appointments they can view
CREATE POLICY "Users can view participants of accessible appointments"
  ON appointment_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM appointments
      WHERE appointments.id = appointment_participants.appointment_id
      AND (
        appointments.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM appointment_participants ap2
          WHERE ap2.appointment_id = appointments.id
          AND ap2.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('warehouse_staff', 'root')
        )
      )
    )
  );

-- Users can add participants to appointments they created
CREATE POLICY "Users can add participants to their appointments"
  ON appointment_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments
      WHERE appointments.id = appointment_participants.appointment_id
      AND appointments.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('warehouse_staff', 'root')
    )
  );

-- Users can update participant status if they are the participant
CREATE POLICY "Users can update their own participant status"
  ON appointment_participants FOR UPDATE
  USING (user_id = auth.uid());

-- Users can remove participants from appointments they created
CREATE POLICY "Users can remove participants from their appointments"
  ON appointment_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM appointments
      WHERE appointments.id = appointment_participants.appointment_id
      AND appointments.created_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('warehouse_staff', 'root')
    )
    OR
    user_id = auth.uid() -- Users can remove themselves
  );

-- ============================================
-- INSERT DEFAULT APPOINTMENT TYPES
-- ============================================
-- Note: These will be inserted by root admin via the API, but we can provide defaults
-- The API will handle creating these with proper created_by values

COMMENT ON TABLE appointment_types IS 'Appointment types managed by root admin';
COMMENT ON TABLE appointments IS 'Warehouse-specific appointments';
COMMENT ON TABLE appointment_participants IS 'Many-to-many relationship for appointment participants';

