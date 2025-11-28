-- TSmart Warehouse Complete Database Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== ENUMS =====
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN', 'OP_MANAGER', 'FINANCE', 'WORKER');
CREATE TYPE booking_type AS ENUM ('PALLET', 'CONTAINER');
CREATE TYPE booking_status AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE payment_status AS ENUM ('NOT_PAID', 'PAID', 'REFUNDED', 'FAILED');
CREATE TYPE product_type AS ENUM ('AMBIENT_FOOD', 'FROZEN', 'ELECTRONICS', 'FRAGILE', 'GENERAL');
CREATE TYPE pallet_size AS ENUM ('STANDARD', 'OVERSIZED');
CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED');
CREATE TYPE alarm_level AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE membership_status AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE incident_type AS ENUM ('DAMAGE', 'DELAY', 'SAFETY', 'MISSING_ITEMS', 'MISPICK', 'EQUIPMENT_FAILURE', 'OTHER');
CREATE TYPE incident_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE incident_status AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'ESCALATED', 'CLOSED');
CREATE TYPE claim_status AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'CLOSED');
CREATE TYPE media_type AS ENUM ('PHOTO', 'VIDEO', 'DOCUMENT');
CREATE TYPE notification_channel AS ENUM ('EMAIL', 'WHATSAPP', 'SMS');
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'DELIVERED', 'READ');

-- ===== PROFILES TABLE (extends auth.users) =====
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  full_name TEXT,
  phone TEXT,
  role user_role DEFAULT 'CUSTOMER',
  company_id UUID,
  employee_id TEXT,
  hourly_rate DECIMAL(10, 2),
  overtime_rate DECIMAL(10, 2),
  notify_via_email BOOLEAN DEFAULT TRUE,
  notify_via_whatsapp BOOLEAN DEFAULT FALSE,
  notify_via_sms BOOLEAN DEFAULT FALSE,
  whatsapp_number TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- ===== COMPANIES TABLE =====
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'USA',
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  quickbooks_customer_id TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- ===== MEMBERSHIPS TABLE =====
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  company_id UUID UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credit_limit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  credit_used DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status membership_status DEFAULT 'ACTIVE',
  payment_terms_days INTEGER DEFAULT 30,
  discount_percentage DECIMAL(5, 2) DEFAULT 0
);

-- ===== WAREHOUSES TABLE =====
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  total_sqft INTEGER NOT NULL,
  max_pallets INTEGER NOT NULL,
  max_containers INTEGER NOT NULL,
  docks_count INTEGER NOT NULL,
  working_hours_start TIME DEFAULT '08:00:00',
  working_hours_end TIME DEFAULT '16:00:00',
  is_active BOOLEAN DEFAULT TRUE
);

-- ===== DOCKS TABLE =====
CREATE TABLE docks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(warehouse_id, number)
);

-- ===== PRICING RULES TABLE =====
CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  product_type product_type NOT NULL,
  pallet_size pallet_size NOT NULL,
  base_price_per_day DECIMAL(10, 2) NOT NULL,
  price_per_kg DECIMAL(10, 4) DEFAULT 0,
  price_per_height_cm DECIMAL(10, 4) DEFAULT 0,
  multiplier DECIMAL(5, 2) DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  notes TEXT
);

-- ===== BOOKINGS TABLE =====
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  company_id UUID NOT NULL REFERENCES companies(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  dock_id UUID REFERENCES docks(id),
  booking_number TEXT UNIQUE NOT NULL,
  type booking_type NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_days INTEGER DEFAULT 1,
  pallets_count INTEGER DEFAULT 0,
  containers_count INTEGER DEFAULT 0,
  container_number TEXT,
  seal_number TEXT,
  status booking_status DEFAULT 'DRAFT',
  total_price DECIMAL(10, 2) DEFAULT 0,
  payment_status payment_status DEFAULT 'NOT_PAID',
  payment_method TEXT,
  stripe_payment_intent_id TEXT,
  notes TEXT,
  customer_notes TEXT,
  confirmed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

-- ===== PRODUCTS TABLE =====
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  product_type product_type NOT NULL,
  pallet_size pallet_size NOT NULL,
  weight_kg DECIMAL(10, 2) NOT NULL,
  height_cm DECIMAL(10, 2) NOT NULL,
  quantity INTEGER DEFAULT 1,
  description TEXT,
  sku TEXT,
  base_price DECIMAL(10, 2),
  weight_charge DECIMAL(10, 2),
  height_charge DECIMAL(10, 2),
  line_total DECIMAL(10, 2)
);

-- ===== INVOICES TABLE =====
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  company_id UUID NOT NULL REFERENCES companies(id),
  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id),
  invoice_number TEXT UNIQUE NOT NULL,
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  paid_at TIMESTAMPTZ,
  paid_amount DECIMAL(10, 2),
  pdf_url TEXT,
  quickbooks_invoice_id TEXT,
  quickbooks_payment_id TEXT,
  synced_to_quickbooks_at TIMESTAMPTZ,
  notes TEXT
);

-- ===== TASKS TABLE =====
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  assigned_to_user_id UUID REFERENCES auth.users(id),
  booking_id UUID REFERENCES bookings(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'TODO',
  priority TEXT DEFAULT 'MEDIUM',
  estimated_duration INTEGER,
  actual_duration INTEGER,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  dock_id UUID REFERENCES docks(id),
  location_notes TEXT,
  completion_notes TEXT,
  completed_by_user_id UUID REFERENCES auth.users(id)
);

-- ===== TIME LOGS TABLE =====
CREATE TABLE time_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  total_hours DECIMAL(10, 2),
  clock_in_location TEXT,
  clock_out_location TEXT,
  notes TEXT
);

-- ===== INCIDENTS TABLE =====
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  incident_number TEXT UNIQUE NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  booking_id UUID REFERENCES bookings(id),
  task_id UUID REFERENCES tasks(id),
  reported_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  assigned_to_user_id UUID REFERENCES auth.users(id),
  type incident_type NOT NULL,
  severity incident_severity NOT NULL,
  status incident_status DEFAULT 'OPEN',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  initial_action TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_summary TEXT,
  root_cause TEXT,
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  customer_notified BOOLEAN DEFAULT FALSE,
  customer_notified_at TIMESTAMPTZ
);

-- ===== CLAIMS TABLE =====
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  claim_number TEXT UNIQUE NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id),
  booking_id UUID REFERENCES bookings(id),
  incident_id UUID REFERENCES incidents(id),
  status claim_status DEFAULT 'DRAFT',
  claim_reason TEXT NOT NULL,
  description TEXT,
  claimed_amount DECIMAL(10, 2) NOT NULL,
  approved_amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  rejection_reason TEXT,
  reviewed_by_user_id UUID REFERENCES auth.users(id),
  approved_by_user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  quickbooks_credit_memo_id TEXT,
  synced_to_quickbooks_at TIMESTAMPTZ
);

-- ===== MEDIA FILES TABLE =====
CREATE TABLE media_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  incident_id UUID REFERENCES incidents(id),
  claim_id UUID REFERENCES claims(id),
  task_id UUID REFERENCES tasks(id),
  booking_id UUID REFERENCES bookings(id),
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  type media_type NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  caption TEXT,
  metadata JSONB
);

-- ===== NOTIFICATIONS TABLE =====
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  recipient_user_id UUID REFERENCES auth.users(id),
  recipient_email TEXT,
  recipient_phone TEXT,
  channel notification_channel NOT NULL,
  status notification_status DEFAULT 'PENDING',
  event_type TEXT NOT NULL,
  template_id TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  variables JSONB,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  booking_id UUID REFERENCES bookings(id),
  task_id UUID REFERENCES tasks(id),
  incident_id UUID REFERENCES incidents(id),
  provider_message_id TEXT,
  provider_response JSONB
);

-- ===== AUDIT LOGS TABLE =====
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  user_role user_role,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  company_id UUID REFERENCES companies(id),
  warehouse_id UUID REFERENCES warehouses(id)
);

-- ===== INDEXES =====
CREATE INDEX idx_profiles_company_id ON profiles(company_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_bookings_company_id ON bookings(company_id);
CREATE INDEX idx_bookings_warehouse_id ON bookings(warehouse_id);
CREATE INDEX idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_number ON bookings(booking_number);
CREATE INDEX idx_tasks_warehouse_id ON tasks(warehouse_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to_user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_incidents_warehouse_id ON incidents(warehouse_id);
CREATE INDEX idx_incidents_status ON incidents(status);

-- ===== UPDATED_AT TRIGGERS =====
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== AUTO-INCREMENT BOOKING NUMBER =====
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_part TEXT;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(booking_number FROM 9) AS INTEGER)), 0) + 1
  INTO next_num
  FROM bookings
  WHERE booking_number LIKE 'BK-' || year_part || '-%';
  NEW.booking_number := 'BK-' || year_part || '-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_generate_number
BEFORE INSERT ON bookings
FOR EACH ROW
WHEN (NEW.booking_number IS NULL)
EXECUTE FUNCTION generate_booking_number();
