/**
 * Create missing tables that failed during migration
 * (replaces auth.users references with profiles)
 */
const { Client } = require('pg')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })

async function run() {
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  console.log('Connected\n')

  const steps = [
    {
      name: 'Add missing bookings columns',
      sql: `ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
        ADD COLUMN IF NOT EXISTS payment_method_id TEXT,
        ADD COLUMN IF NOT EXISTS guest_email TEXT,
        ADD COLUMN IF NOT EXISTS is_guest_booking BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
        ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS amount_due DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS payment_notes TEXT,
        ADD COLUMN IF NOT EXISTS booking_status TEXT DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS cancel_requested_by UUID,
        ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
        ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS refund_status TEXT,
        ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS booked_by UUID,
        ADD COLUMN IF NOT EXISTS booked_on_behalf_of UUID,
        ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS approval_status TEXT,
        ADD COLUMN IF NOT EXISTS short_id TEXT,
        ADD COLUMN IF NOT EXISTS created_by UUID,
        ADD COLUMN IF NOT EXISTS updated_by UUID`
    },
    {
      name: 'Create payments',
      sql: `CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'pending',
        payment_method TEXT NOT NULL DEFAULT 'card',
        stripe_payment_intent_id TEXT,
        stripe_charge_id TEXT,
        credit_balance_used DECIMAL(10, 2) DEFAULT 0.00,
        metadata JSONB,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )`
    },
    {
      name: 'Create payment_transactions',
      sql: `CREATE TABLE IF NOT EXISTS payment_transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'payment',
        amount DECIMAL(10, 2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'pending',
        description TEXT NOT NULL DEFAULT '',
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create refunds',
      sql: `CREATE TABLE IF NOT EXISTS refunds (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        stripe_refund_id TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      )`
    },
    {
      name: 'Create inventory_items',
      sql: `CREATE TABLE IF NOT EXISTS inventory_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
        customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
        warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
        floor_id UUID REFERENCES warehouse_floors(id) ON DELETE SET NULL,
        hall_id UUID REFERENCES warehouse_halls(id) ON DELETE SET NULL,
        zone_id UUID REFERENCES warehouse_zones(id) ON DELETE SET NULL,
        region_id UUID REFERENCES warehouse_regions(id) ON DELETE SET NULL,
        pallet_id TEXT UNIQUE NOT NULL,
        barcode TEXT,
        qr_code TEXT,
        description TEXT,
        item_type TEXT,
        weight_kg DECIMAL(10, 2),
        dimensions JSONB,
        location_code TEXT,
        row_number INTEGER,
        level_number INTEGER,
        status TEXT NOT NULL DEFAULT 'received',
        received_at TIMESTAMPTZ,
        stored_at TIMESTAMPTZ,
        last_moved_at TIMESTAMPTZ,
        shipped_at TIMESTAMPTZ,
        notes TEXT,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create inventory_movements',
      sql: `CREATE TABLE IF NOT EXISTS inventory_movements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        moved_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
        moved_by_name TEXT NOT NULL DEFAULT '',
        movement_type TEXT NOT NULL DEFAULT 'received',
        from_location TEXT,
        to_location TEXT,
        from_location_code TEXT,
        to_location_code TEXT,
        from_hall_id UUID REFERENCES warehouse_halls(id) ON DELETE SET NULL,
        to_hall_id UUID REFERENCES warehouse_halls(id) ON DELETE SET NULL,
        from_zone_id UUID REFERENCES warehouse_zones(id) ON DELETE SET NULL,
        to_zone_id UUID REFERENCES warehouse_zones(id) ON DELETE SET NULL,
        reason TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create booking_services',
      sql: `CREATE TABLE IF NOT EXISTS booking_services (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        service_id UUID,
        service_name TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        unit_price DECIMAL(10,2) DEFAULT 0,
        total_price DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create booking_requests',
      sql: `CREATE TABLE IF NOT EXISTS booking_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
        requested_by UUID REFERENCES profiles(id),
        status TEXT DEFAULT 'pending',
        request_type TEXT DEFAULT 'new',
        notes TEXT,
        po_number TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create booking_approvals',
      sql: `CREATE TABLE IF NOT EXISTS booking_approvals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        approved_by UUID REFERENCES profiles(id),
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create shipments',
      sql: `CREATE TABLE IF NOT EXISTS shipments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        tracking_number TEXT,
        carrier TEXT,
        status TEXT DEFAULT 'pending',
        shipped_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create pallet_checkout_requests',
      sql: `CREATE TABLE IF NOT EXISTS pallet_checkout_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        requested_by UUID REFERENCES profiles(id),
        pallet_ids TEXT[],
        status TEXT DEFAULT 'pending',
        checkout_date TIMESTAMPTZ,
        notes TEXT,
        qr_code TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create conversations',
      sql: `CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
        customer_id UUID REFERENCES profiles(id),
        subject TEXT,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create conversation_messages',
      sql: `CREATE TABLE IF NOT EXISTS conversation_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES profiles(id),
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create estimates',
      sql: `CREATE TABLE IF NOT EXISTS estimates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
        customer_id UUID REFERENCES profiles(id),
        warehouse_id UUID REFERENCES warehouses(id),
        status TEXT DEFAULT 'draft',
        items JSONB DEFAULT '[]',
        subtotal DECIMAL(10,2) DEFAULT 0,
        tax DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) DEFAULT 0,
        valid_until DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create invoice_templates',
      sql: `CREATE TABLE IF NOT EXISTS invoice_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        warehouse_id UUID REFERENCES warehouses(id),
        name TEXT NOT NULL,
        items JSONB DEFAULT '[]',
        notes TEXT,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Create cash_collections',
      sql: `CREATE TABLE IF NOT EXISTS cash_collections (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        invoice_id UUID REFERENCES invoices(id),
        collected_by UUID REFERENCES profiles(id),
        amount DECIMAL(10,2) NOT NULL,
        currency TEXT DEFAULT 'USD',
        notes TEXT,
        receipt_number TEXT,
        collected_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    },
    {
      name: 'Add soft delete to key tables',
      sql: `DO $$ BEGIN
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      END $$`
    },
  ]

  for (const step of steps) {
    try {
      await c.query(step.sql)
      console.log(`OK    ${step.name}`)
    } catch (e) {
      console.log(`WARN  ${step.name}: ${e.message.substring(0, 100)}`)
    }
  }

  // Final count
  const { rows } = await c.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  )
  console.log(`\nTotal tables: ${rows.length}`)
  rows.forEach(r => console.log(`  ${r.tablename}`))

  await c.end()
}

run()
