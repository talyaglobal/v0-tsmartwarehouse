# TSmart Warehouse Management System - Database Schema Documentation

**Database:** PostgreSQL (Supabase)  
**Version:** 1.0.0  
**Last Updated:** December 2024

---

## Table of Contents

- [Overview](#overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Tables](#tables)
  - [users](#users)
  - [warehouses](#warehouses)
  - [warehouse_floors](#warehouse_floors)
  - [warehouse_halls](#warehouse_halls)
  - [warehouse_zones](#warehouse_zones)
  - [bookings](#bookings)
  - [invoices](#invoices)
  - [tasks](#tasks)
  - [incidents](#incidents)
  - [claims](#claims)
  - [notifications](#notifications)
  - [worker_shifts](#worker_shifts)
  - [profiles](#profiles)
  - [notification_preferences](#notification_preferences)
  - [payments](#payments)
- [Indexes](#indexes)
- [Triggers](#triggers)
- [Row Level Security (RLS)](#row-level-security-rls)
- [Data Types Reference](#data-types-reference)

---

## Overview

The database schema supports a multi-tenant warehouse management system with three user roles:
- **Admin**: Full system access
- **Customer**: Booking and claim management
- **Worker**: Task and inventory management

The warehouse structure consists of:
- 3 floors
- 2 halls per floor (A and B)
- Multiple zones per hall (pallet, area-rental, cold-storage, hazmat)

---

## Entity Relationship Diagram

```
users (1) ──< (N) bookings
users (1) ──< (N) invoices
users (1) ──< (N) tasks (assigned_to)
users (1) ──< (N) incidents (reported_by)
users (1) ──< (N) claims
users (1) ──< (N) notifications
users (1) ──< (N) worker_shifts
users (1) ──< (1) profiles

warehouses (1) ──< (N) warehouse_floors
warehouse_floors (1) ──< (N) warehouse_halls
warehouse_halls (1) ──< (N) warehouse_zones
warehouses (1) ──< (N) bookings
warehouses (1) ──< (N) tasks
warehouses (1) ──< (N) incidents
warehouses (1) ──< (N) worker_shifts

bookings (1) ──< (N) invoices
bookings (1) ──< (N) tasks
bookings (1) ──< (N) claims
incidents (1) ──< (N) claims
```

---

## Tables

### users

Stores user account information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | User unique identifier |
| `email` | TEXT | UNIQUE, NOT NULL | User email address |
| `name` | TEXT | NOT NULL | User full name |
| `role` | TEXT | NOT NULL, CHECK IN ('admin', 'customer', 'worker') | User role |
| `company` | TEXT | | Company name (optional) |
| `phone` | TEXT | | Phone number (optional) |
| `avatar` | TEXT | | Avatar URL (optional) |
| `membership_tier` | TEXT | CHECK IN ('bronze', 'silver', 'gold', 'platinum') | Membership tier |
| `credit_balance` | DECIMAL(10,2) | DEFAULT 0.00 | Account credit balance |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_users_email` on `email`
- `idx_users_role` on `role`

---

### warehouses

Stores warehouse facility information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Warehouse unique identifier |
| `name` | TEXT | NOT NULL | Warehouse name |
| `address` | TEXT | NOT NULL | Street address |
| `city` | TEXT | NOT NULL | City |
| `state` | TEXT | NOT NULL | State/Province |
| `zip_code` | TEXT | NOT NULL | ZIP/Postal code |
| `total_sq_ft` | INTEGER | NOT NULL | Total square footage |
| `amenities` | TEXT[] | | Array of amenities |
| `operating_hours` | JSONB | | Operating hours (JSON object) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

---

### warehouse_floors

Stores floor information for each warehouse.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Floor unique identifier |
| `warehouse_id` | UUID | NOT NULL, FK → warehouses(id) | Parent warehouse |
| `floor_number` | INTEGER | NOT NULL, CHECK IN (1,2,3) | Floor number (1-3) |
| `name` | TEXT | NOT NULL | Floor name |
| `total_sq_ft` | INTEGER | NOT NULL | Total square footage |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Constraints:**
- UNIQUE(`warehouse_id`, `floor_number`)

**Indexes:**
- `idx_warehouse_floors_warehouse_id` on `warehouse_id`

---

### warehouse_halls

Stores hall information for each floor.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Hall unique identifier |
| `floor_id` | UUID | NOT NULL, FK → warehouse_floors(id) | Parent floor |
| `hall_name` | TEXT | NOT NULL, CHECK IN ('A', 'B') | Hall name (A or B) |
| `sq_ft` | INTEGER | NOT NULL | Total square footage |
| `available_sq_ft` | INTEGER | NOT NULL | Available square footage |
| `occupied_sq_ft` | INTEGER | NOT NULL, DEFAULT 0 | Occupied square footage |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Constraints:**
- UNIQUE(`floor_id`, `hall_name`)

**Indexes:**
- `idx_warehouse_halls_floor_id` on `floor_id`

---

### warehouse_zones

Stores zone information for each hall.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Zone unique identifier |
| `hall_id` | UUID | NOT NULL, FK → warehouse_halls(id) | Parent hall |
| `name` | TEXT | NOT NULL | Zone name |
| `type` | TEXT | NOT NULL, CHECK IN ('pallet', 'area-rental', 'cold-storage', 'hazmat') | Zone type |
| `total_slots` | INTEGER | | Total pallet slots (for pallet zones) |
| `available_slots` | INTEGER | | Available pallet slots |
| `total_sq_ft` | INTEGER | | Total square footage (for area-rental zones) |
| `available_sq_ft` | INTEGER | | Available square footage |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_warehouse_zones_hall_id` on `hall_id`
- `idx_warehouse_zones_type` on `type`

---

### bookings

Stores customer booking information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Booking unique identifier |
| `customer_id` | UUID | NOT NULL, FK → users(id) | Customer user ID |
| `customer_name` | TEXT | NOT NULL | Customer name (denormalized) |
| `customer_email` | TEXT | NOT NULL | Customer email (denormalized) |
| `warehouse_id` | UUID | NOT NULL, FK → warehouses(id) | Warehouse ID |
| `type` | TEXT | NOT NULL, CHECK IN ('pallet', 'area-rental') | Booking type |
| `status` | TEXT | NOT NULL, CHECK IN ('pending', 'confirmed', 'active', 'completed', 'cancelled') | Booking status |
| `pallet_count` | INTEGER | | Number of pallets (for pallet bookings) |
| `area_sq_ft` | INTEGER | | Area in square feet (for area-rental bookings) |
| `floor_number` | INTEGER | CHECK IN (3) | Floor number (only for area-rental, must be 3) |
| `hall_id` | UUID | FK → warehouse_halls(id) | Hall ID (for area-rental) |
| `start_date` | DATE | NOT NULL | Booking start date |
| `end_date` | DATE | | Booking end date (optional) |
| `total_amount` | DECIMAL(10,2) | NOT NULL | Total booking amount |
| `notes` | TEXT | | Additional notes |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_bookings_customer_id` on `customer_id`
- `idx_bookings_warehouse_id` on `warehouse_id`
- `idx_bookings_status` on `status`
- `idx_bookings_type` on `type`
- `idx_bookings_start_date` on `start_date`

---

### invoices

Stores invoice information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Invoice unique identifier |
| `booking_id` | UUID | NOT NULL, FK → bookings(id) | Related booking |
| `customer_id` | UUID | NOT NULL, FK → users(id) | Customer user ID |
| `customer_name` | TEXT | NOT NULL | Customer name (denormalized) |
| `status` | TEXT | NOT NULL, CHECK IN ('draft', 'pending', 'paid', 'overdue', 'cancelled') | Invoice status |
| `items` | JSONB | NOT NULL | Invoice line items (JSON array) |
| `subtotal` | DECIMAL(10,2) | NOT NULL | Subtotal amount |
| `tax` | DECIMAL(10,2) | NOT NULL | Tax amount |
| `total` | DECIMAL(10,2) | NOT NULL | Total amount |
| `due_date` | DATE | NOT NULL | Payment due date |
| `paid_date` | DATE | | Payment date (when paid) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_invoices_booking_id` on `booking_id`
- `idx_invoices_customer_id` on `customer_id`
- `idx_invoices_status` on `status`
- `idx_invoices_due_date` on `due_date`

**Items JSONB Structure:**
```json
[
  {
    "description": "Pallet storage",
    "quantity": 50,
    "unit_price": 17.50,
    "total": 875.00
  }
]
```

---

### tasks

Stores worker task information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Task unique identifier |
| `type` | TEXT | NOT NULL, CHECK IN ('receiving', 'putaway', 'picking', 'packing', 'shipping', 'inventory-check', 'maintenance') | Task type |
| `title` | TEXT | NOT NULL | Task title |
| `description` | TEXT | NOT NULL | Task description |
| `status` | TEXT | NOT NULL, CHECK IN ('pending', 'assigned', 'in-progress', 'completed', 'cancelled') | Task status |
| `priority` | TEXT | NOT NULL, CHECK IN ('low', 'medium', 'high', 'urgent') | Task priority |
| `assigned_to` | UUID | FK → users(id) | Assigned worker ID |
| `assigned_to_name` | TEXT | | Assigned worker name (denormalized) |
| `booking_id` | UUID | FK → bookings(id) | Related booking |
| `warehouse_id` | UUID | NOT NULL, FK → warehouses(id) | Warehouse ID |
| `zone` | TEXT | | Zone identifier |
| `location` | TEXT | | Location description |
| `due_date` | TIMESTAMPTZ | | Task due date |
| `completed_at` | TIMESTAMPTZ | | Completion timestamp |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_tasks_assigned_to` on `assigned_to`
- `idx_tasks_booking_id` on `booking_id`
- `idx_tasks_warehouse_id` on `warehouse_id`
- `idx_tasks_status` on `status`
- `idx_tasks_priority` on `priority`
- `idx_tasks_due_date` on `due_date`

---

### incidents

Stores incident reports.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Incident unique identifier |
| `type` | TEXT | NOT NULL | Incident type |
| `title` | TEXT | NOT NULL | Incident title |
| `description` | TEXT | NOT NULL | Incident description |
| `severity` | TEXT | NOT NULL, CHECK IN ('low', 'medium', 'high', 'critical') | Severity level |
| `status` | TEXT | NOT NULL, CHECK IN ('open', 'investigating', 'resolved', 'closed') | Incident status |
| `reported_by` | UUID | NOT NULL, FK → users(id) | Reporter user ID |
| `reported_by_name` | TEXT | NOT NULL | Reporter name (denormalized) |
| `warehouse_id` | UUID | NOT NULL, FK → warehouses(id) | Warehouse ID |
| `location` | TEXT | | Location description |
| `affected_booking_id` | UUID | FK → bookings(id) | Affected booking (if any) |
| `resolution` | TEXT | | Resolution notes |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `resolved_at` | TIMESTAMPTZ | | Resolution timestamp |

**Indexes:**
- `idx_incidents_reported_by` on `reported_by`
- `idx_incidents_warehouse_id` on `warehouse_id`
- `idx_incidents_status` on `status`
- `idx_incidents_severity` on `severity`
- `idx_incidents_affected_booking_id` on `affected_booking_id`

---

### claims

Stores customer claims.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Claim unique identifier |
| `customer_id` | UUID | NOT NULL, FK → users(id) | Customer user ID |
| `customer_name` | TEXT | NOT NULL | Customer name (denormalized) |
| `incident_id` | UUID | FK → incidents(id) | Related incident (if any) |
| `booking_id` | UUID | NOT NULL, FK → bookings(id) | Related booking |
| `type` | TEXT | NOT NULL | Claim type |
| `description` | TEXT | NOT NULL | Claim description |
| `amount` | DECIMAL(10,2) | NOT NULL | Claimed amount |
| `status` | TEXT | NOT NULL, CHECK IN ('submitted', 'under-review', 'approved', 'rejected', 'paid') | Claim status |
| `evidence` | TEXT[] | | Array of evidence file URLs |
| `resolution` | TEXT | | Resolution notes |
| `approved_amount` | DECIMAL(10,2) | | Approved amount (if approved) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `resolved_at` | TIMESTAMPTZ | | Resolution timestamp |

**Indexes:**
- `idx_claims_customer_id` on `customer_id`
- `idx_claims_incident_id` on `incident_id`
- `idx_claims_booking_id` on `booking_id`
- `idx_claims_status` on `status`

---

### notifications

Stores user notifications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Notification unique identifier |
| `user_id` | UUID | NOT NULL, FK → users(id) | User ID |
| `type` | TEXT | NOT NULL, CHECK IN ('booking', 'invoice', 'task', 'incident', 'system') | Notification type |
| `channel` | TEXT | NOT NULL, CHECK IN ('email', 'sms', 'push', 'whatsapp') | Delivery channel |
| `title` | TEXT | NOT NULL | Notification title |
| `message` | TEXT | NOT NULL | Notification message |
| `read` | BOOLEAN | DEFAULT FALSE | Read status |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_notifications_user_id` on `user_id`
- `idx_notifications_read` on `read`
- `idx_notifications_created_at` on `created_at`

---

### worker_shifts

Stores worker shift information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Shift unique identifier |
| `worker_id` | UUID | NOT NULL, FK → users(id) | Worker user ID |
| `worker_name` | TEXT | NOT NULL | Worker name (denormalized) |
| `check_in_time` | TIMESTAMPTZ | NOT NULL | Check-in timestamp |
| `check_out_time` | TIMESTAMPTZ | | Check-out timestamp |
| `hours_worked` | DECIMAL(4,2) | | Hours worked |
| `breaks` | JSONB | DEFAULT '[]' | Break periods (JSON array) |
| `tasks_completed` | INTEGER | DEFAULT 0 | Number of tasks completed |
| `warehouse_id` | UUID | NOT NULL, FK → warehouses(id) | Warehouse ID |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_worker_shifts_worker_id` on `worker_id`
- `idx_worker_shifts_warehouse_id` on `warehouse_id`
- `idx_worker_shifts_check_in_time` on `check_in_time`

---

### profiles

Stores Supabase Auth user profiles (linked to auth.users).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, FK → auth.users(id) | User ID (from Supabase Auth) |
| `name` | TEXT | | User full name |
| `email` | TEXT | | User email |
| `role` | TEXT | CHECK IN ('admin', 'customer', 'worker') | User role |
| `company` | TEXT | | Company name |
| `phone` | TEXT | | Phone number |
| `avatar` | TEXT | | Avatar URL |
| `email_verified` | BOOLEAN | DEFAULT FALSE | Email verification status |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

---

### notification_preferences

Stores user notification preferences.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Preference unique identifier |
| `user_id` | UUID | NOT NULL, FK → profiles(id) | User ID |
| `channel` | TEXT | NOT NULL, CHECK IN ('email', 'sms', 'push', 'whatsapp') | Notification channel |
| `enabled` | BOOLEAN | DEFAULT TRUE | Channel enabled status |
| `types` | JSONB | DEFAULT '{}' | Per-type preferences (JSON object) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

---

### payments

Stores payment transaction information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Payment unique identifier |
| `invoice_id` | UUID | FK → invoices(id) | Related invoice |
| `customer_id` | UUID | NOT NULL, FK → profiles(id) | Customer user ID |
| `amount` | DECIMAL(10,2) | NOT NULL | Payment amount |
| `currency` | TEXT | NOT NULL, DEFAULT 'USD' | Currency code |
| `status` | TEXT | NOT NULL, CHECK IN ('pending', 'processing', 'completed', 'failed', 'refunded') | Payment status |
| `payment_method` | TEXT | | Payment method (stripe, paypal, etc.) |
| `transaction_id` | TEXT | | External transaction ID |
| `stripe_payment_intent_id` | TEXT | | Stripe payment intent ID |
| `metadata` | JSONB | | Additional metadata (JSON object) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

---

## Indexes

All indexes are automatically created by the migration script. Key indexes include:

- **Primary Keys**: All tables have UUID primary keys
- **Foreign Keys**: Indexed for join performance
- **Common Filters**: Status, type, dates, and user IDs are indexed
- **Search Fields**: Email, names, and identifiers are indexed

---

## Triggers

### Automatic `updated_at` Updates

All tables with `updated_at` columns have triggers that automatically update the timestamp on row updates:

- `update_users_updated_at`
- `update_warehouses_updated_at`
- `update_warehouse_floors_updated_at`
- `update_warehouse_halls_updated_at`
- `update_warehouse_zones_updated_at`
- `update_bookings_updated_at`
- `update_tasks_updated_at`
- `update_worker_shifts_updated_at`

---

## Row Level Security (RLS)

Row Level Security is **enabled** on all tables but **policies are not yet configured**. You must create RLS policies based on your authentication setup.

### Example RLS Policies

```sql
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Customers can view their own bookings
CREATE POLICY "Customers can view own bookings" ON bookings
  FOR SELECT USING (auth.uid() = customer_id);

-- Admins can view all data
CREATE POLICY "Admins can view all" ON bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
```

**Important:** Configure RLS policies before deploying to production!

---

## Data Types Reference

### UUID
- PostgreSQL UUID type
- Generated using `uuid_generate_v4()`
- Used for all primary keys and foreign keys

### TEXT
- Variable-length text
- Used for names, descriptions, emails, etc.

### INTEGER
- 32-bit integer
- Used for counts, square footage, etc.

### DECIMAL(10,2)
- Fixed-precision decimal
- Used for monetary amounts
- Format: `99999999.99`

### TIMESTAMPTZ
- Timestamp with timezone
- Stored in UTC
- Used for all date/time fields

### DATE
- Date without time
- Used for booking dates, due dates, etc.

### BOOLEAN
- True/false values
- Used for flags like `read`, `enabled`, etc.

### TEXT[]
- Array of text values
- Used for amenities, evidence files, etc.

### JSONB
- Binary JSON
- Used for flexible data structures (items, metadata, etc.)

---

## Migration Files

Database schema is managed through migration files in `supabase/migrations/`:

1. `001_initial_schema.sql` - Core schema
2. `001_create_profiles_table.sql` - Supabase Auth profiles
3. `002_notification_preferences.sql` - Notification preferences
4. `003_enable_realtime.sql` - Realtime subscriptions
5. `003_payments_schema.sql` - Payment transactions

---

## Best Practices

1. **Always use UUIDs** for primary keys
2. **Denormalize frequently accessed data** (e.g., customer_name in bookings)
3. **Use JSONB** for flexible schema (items, metadata)
4. **Index foreign keys** and commonly filtered columns
5. **Use CHECK constraints** for enum-like values
6. **Enable RLS** on all tables
7. **Use triggers** for automatic timestamp updates
8. **Validate data** at the application level before inserting

---

## Future Enhancements

- Audit logging table
- Soft deletes (deleted_at columns)
- Full-text search indexes
- Materialized views for analytics
- Database functions for complex queries
- Partitioning for large tables (bookings, tasks)

